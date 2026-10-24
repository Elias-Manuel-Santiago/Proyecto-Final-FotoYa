import test, { after, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/config/database.js';
import { actor } from './fixtures.js';
import { salesService } from '../src/modules/sales/sales.service.js';
import { eventCache, createEventCache } from '../src/modules/sales/sales.events.js';

afterEach(() => mock.restoreAll());
after(() => db.end());

test('publica la apertura después del commit; un rollback conserva el estado anterior', async () => {
  const cache = createEventCache();
  mock.method(eventCache, 'get', key => cache.get(key));
  mock.method(eventCache, 'set', (key, value) => cache.set(key, value));
  let failCommit = true;
  const connection = {
    beginTransaction: async () => {}, rollback: async () => {}, release: () => {},
    commit: async () => { if (failCommit) throw new Error('commit fallido'); },
    execute: async sql => {
      if (sql.includes('SELECT id_puesto AS stationId')) return [[{ stationId: '10', roleId: '2' }]];
      if (sql.includes('JOIN permisos_rol')) return [[{ role: 'encargado' }]];
      if (sql.includes('FROM puesto')) return [[{ active: true }]];
      if (sql.startsWith('INSERT INTO dias')) return [{}];
      if (sql.includes('SELECT id_dias AS id')) return [[{ id: '20' }]];
      assert.fail(`Consulta inesperada: ${sql}`);
    },
  };
  mock.method(db, 'getConnection', async () => connection);
  const manager = actor('encargado', { permissions: ['sales.create'] });
  await assert.rejects(salesService.setEvent(manager, { stationId: '10', open: true }), /commit fallido/);
  assert.equal(cache.get('10'), undefined);
  failCommit = false;
  assert.equal((await salesService.setEvent(manager, { stationId: '10', open: true })).open, true);
  assert.equal(cache.get('10').dayId, '20');
  failCommit = true;
  await assert.rejects(salesService.setEvent(manager, { stationId: '10', open: false }), /commit fallido/);
  assert.equal(cache.get('10').open, true);
  failCommit = false;
  assert.equal((await salesService.setEvent(manager, { stationId: '10', open: false })).open, false);
});
