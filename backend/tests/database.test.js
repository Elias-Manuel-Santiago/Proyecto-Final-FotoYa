import test, { mock, after } from 'node:test';
import assert from 'node:assert/strict';
import { once } from 'node:events';
import { setTimeout as delay } from 'node:timers/promises';
import mysql from 'mysql2';
import { env as runtimeEnv } from '../src/config/env.js';
import { db as sharedDb } from '../src/config/database.js';
import { loadEnv } from '../src/config/env.js';
import { transaction } from '../src/shared/transaction.js';
import { env } from './fixtures.js';

test('database defaults keep a small per-process connection budget', () => {
  const config = { ...env, CORS_ORIGINS: env.CORS_ORIGINS.join(',') };
  delete config.DB_CONNECTION_LIMIT;
  delete config.DB_IDLE_TIMEOUT_MS;
  assert.equal(loadEnv(config).DB_CONNECTION_LIMIT, 2);
  assert.equal(loadEnv(config).DB_IDLE_TIMEOUT_MS, 10000);
  for (const key of ['DB_CONNECTION_LIMIT', 'DB_IDLE_TIMEOUT_MS']) {
    assert.throws(() => loadEnv({ ...config, [key]: '0' }));
    assert.throws(() => loadEnv({ ...config, [key]: 'invalid' }));
  }
});

// A local MySQL protocol stub exercises the actual driver and TCP lifecycle.
// It never connects to the application's configured database.
for (const limit of [1, 2]) {
  test(`pool caps connections at ${limit}, reuses/releases them and closes idle sockets`, { timeout: 10000 }, async t => {
    const server = mysql.createServer();
    const sockets = new Set();
    let db;
    let opened = 0, peak = 0;
    server.on('connection', connection => {
      opened++;
      sockets.add(connection.stream);
      peak = Math.max(peak, sockets.size);
      connection.stream.once('close', () => sockets.delete(connection.stream));
      connection.on('error', () => {});
      connection.serverHandshake({
        protocolVersion: 10, serverVersion: '8.0.0-test', connectionId: opened,
        statusFlags: 2, characterSet: 45, capabilityFlags: 0x00088201,
        authCallback: (_auth, done) => { done(); connection._resetSequenceId(); },
      });
      const respond = sql => {
        if (sql === 'FAIL') connection.writeError({ code: 1064, message: 'simulated query failure' });
        else connection.writeOk();
        connection._resetSequenceId();
      };
      connection.on('stmt_prepare', respond); // SET time_zone
      connection.on('query', respond);
    });
    t.after(async () => {
      if (db) await db.end();
      for (const socket of sockets) socket.destroy();
      await new Promise(resolve => server.close(resolve));
    });
    server.listen(0, '127.0.0.1');
    await once(server._server, 'listening');
    Object.assign(runtimeEnv, {
      ...env, DB_HOST: '127.0.0.1', DB_PORT: server._server.address().port,
      DB_SSL_CA_PATH: undefined, DB_CONNECTION_LIMIT: limit, DB_IDLE_TIMEOUT_MS: 50,
    });
    ({ db } = await import(`../src/config/database.js?limit=${limit}`));
    const replacement = mock.method(sharedDb, 'getConnection', () => db.getConnection());
    t.after(() => replacement.mock.restore());

    const held = await Promise.all(Array.from({ length: limit }, () => db.getConnection()));
    const queued = once(db, 'enqueue');
    const waiting = db.getConnection();
    await queued;
    assert.equal(opened, limit);
    held.pop().release();
    const reused = await waiting;
    assert.equal(opened, limit);
    reused.release();
    for (const connection of held) connection.release();

    await assert.rejects(db.query('FAIL'), { code: 'ER_PARSE_ERROR' });
    await assert.rejects(transaction(connection => connection.query('FAIL')), { code: 'ER_PARSE_ERROR' });
    await transaction(connection => connection.query('SELECT 1'));
    assert.equal(opened, limit);
    assert.equal(peak, limit);

    const deadline = Date.now() + 4000;
    while (sockets.size && Date.now() < deadline) await delay(25);
    assert.equal(sockets.size, 0, 'idle connections must close, including when connectionLimit=1');

    await db.query('SELECT 1');
    assert.equal(opened, limit + 1, 'queries reconnect after idle cleanup');
  });
}

after(() => sharedDb.end());
