import { readFile, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';
import { loadEnv } from '../src/config/env.js';
import { createDatabase } from '../src/config/database.js';
import { createPrivacy } from '../src/security/crypto.js';
import { protectUsers } from './lib/protect-users.js';
import { seedPermissions } from './lib/seed-permissions.js';

export async function migrate(db, env, { init = false } = {}) {
  const connection = await db.getConnection();
  try {
    const [[lock]] = await connection.query("SELECT GET_LOCK('foto_ya_schema', 10) AS acquired");
    if (!Number(lock.acquired)) throw new Error('Otra migración está ejecutándose.');
    if (init) {
      const [[existing]] = await connection.query("SELECT COUNT(*) AS count FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'usuarios'");
      if (Number(existing.count)) throw new Error('La base ya está inicializada. Usá db:migrate.');
      const sql = await readFile(new URL('../../database/foto_ya.sql', import.meta.url), 'utf8');
      for (const statement of sql.split(';').map(s => s.trim()).filter(Boolean)) await connection.query(statement);
    }
    await connection.query('CREATE TABLE IF NOT EXISTS backend_migrations (name VARCHAR(150) PRIMARY KEY, checksum CHAR(64) NOT NULL, applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP) ENGINE = InnoDB');
    const directory = new URL('../database/', import.meta.url);
    for (const file of (await readdir(directory)).filter(v => v.endsWith('.sql')).sort()) {
      const sql = await readFile(new URL(file, directory), 'utf8');
      const checksum = createHash('sha256').update(sql).digest('hex');
      const [[done]] = await connection.execute('SELECT checksum FROM backend_migrations WHERE name = ?', [file]);
      if (done && done.checksum !== checksum) throw new Error(`La migración aplicada ${file} fue modificada.`);
      if (done) continue;
      for (const statement of sql.split(';').map(s => s.trim()).filter(Boolean)) await connection.query(statement);
      await connection.execute('INSERT INTO backend_migrations (name, checksum) VALUES (?, ?)', [file, checksum]);
    }
    const privacy = createPrivacy(env);
    await connection.beginTransaction();
    await protectUsers(connection, privacy);
    // Sólo el primer seed establece la matriz. Los siguientes preservan cambios de permisos.
    await seedPermissions(connection);
    await connection.commit();
  } catch (error) { await connection.rollback().catch(() => {}); throw error; }
  finally {
    await connection.query("SELECT RELEASE_LOCK('foto_ya_schema')").catch(() => {});
    connection.release();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const env = loadEnv(), db = createDatabase(env);
  try { await migrate(db, env, { init: process.argv.includes('--init') }); console.log('Migraciones y protección de datos completadas.'); }
  catch (error) { console.error({ code: error.code ?? 'MIGRATION_ERROR', message: error.code ? 'La migración falló. Revisá el esquema y sus restricciones.' : error.message }); process.exitCode = 1; }
  finally { await db.end(); }
}
