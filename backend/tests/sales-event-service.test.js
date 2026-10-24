import test, { after, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/config/database.js';
import { actor } from './fixtures.js';
import { kioskService } from '../src/modules/attendance/kiosk.service.js';
import { eventCache, createEventCache } from '../src/modules/sales/sales.events.js';
import { businessDate } from '../src/modules/sales/sales.rules.js';
import { hashPassword } from '../src/security/crypto.js';

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
    query: async () => [[]],
    execute: async sql => {
      if (sql.includes('SELECT u.password')) return [[{ stationId: '10', role: 'encargado', disponible: true }]];
      if (sql.includes('SELECT check_in_mode')) return [[{ kioskMode: true }]];
      if (sql.includes('FROM puesto')) return [[{ active: true }]];
      if (sql.startsWith('INSERT INTO dias')) return [{}];
      if (sql.includes('SELECT id_dias AS id')) return [[{ id: '20' }]];
      if (sql.startsWith('UPDATE horarios')) return [{ affectedRows: 1 }];
      assert.fail(`Consulta inesperada: ${sql}`);
    },
  };
  mock.method(db, 'getConnection', async () => connection);
  const manager = actor('encargado', { kioskMode: true });
  await assert.rejects(kioskService.setEvent(manager, { open: true }), /commit fallido/);
  assert.equal(cache.get('10'), undefined);
  failCommit = false;
  assert.equal((await kioskService.setEvent(manager, { open: true })).open, true);
  assert.equal(cache.get('10').dayId, '20');
  failCommit = true;
  await assert.rejects(kioskService.setEvent(manager, { open: false }), /commit fallido/);
  assert.equal(cache.get('10').open, true);
  failCommit = false;
  assert.equal((await kioskService.setEvent(manager, { open: false })).open, false);
});

test('una marcación iniciada durante el cierre espera el commit y rechaza ambas acciones', { timeout: 3000 }, async () => {
  const cache = createEventCache();
  cache.set('10', { open: true, date: businessDate(), dayId: '20' });
  mock.method(eventCache, 'get', key => cache.get(key));
  mock.method(eventCache, 'set', (key, value) => cache.set(key, value));
  let commitStarted, releaseCommit;
  const started = new Promise(resolve => { commitStarted = resolve; });
  const gate = new Promise(resolve => { releaseCommit = resolve; });
  let connections = 0;
  let closures = 0;
  const connection = {
    beginTransaction: async () => {}, rollback: async () => {}, release: () => {},
    query: async () => [[]],
    commit: async () => { commitStarted(); await gate; },
    execute: async sql => {
      if (sql.includes('SELECT u.password')) return [[{ stationId: '10', role: 'encargado', disponible: true }]];
      if (sql.includes('SELECT check_in_mode')) return [[{ kioskMode: true }]];
      if (sql.includes('FROM puesto')) return [[{ active: true }]];
      if (sql.startsWith('UPDATE horarios')) { closures++; return [{ affectedRows: 1 }]; }
      assert.fail(`No se deben consultar ni modificar horarios con ventas cerradas: ${sql}`);
    },
  };
  mock.method(db, 'getConnection', async () => { connections++; return connection; });
  const manager = actor('encargado', { kioskMode: true });
  const close = kioskService.setEvent(manager, { open: false });
  await started;
  const marks = Promise.allSettled(['check-in', 'check-out'].map(action => kioskService.mark(manager, {
    userId: '2', email: 'employee@example.com', password: 'password', action, attendanceId: action === 'check-in' ? null : '1',
  })));
  try {
    await Promise.resolve();
    assert.equal(connections, 1, 'las marcaciones esperan sin reservar conexiones');
    assert.equal(cache.get('10').open, true, 'el cierre no se publica antes del commit');
  } finally { releaseCommit(); }
  assert.equal((await close).open, false);
  assert.equal(closures, 1, 'solo el cierre administrativo modifica los horarios pendientes');
  const results = await marks;
  for (const result of results) {
    assert.equal(result.status, 'rejected');
    assert.equal(result.reason.code, 'EVENT_CLOSED');
  }
});

test('el cambio de día permite entradas y salidas hasta el cierre manual, sin modificar la fecha de entrada', async () => {
  const cache = createEventCache();
  cache.set('10', { open: true, date: '2000-01-01', dayId: '20' });
  mock.method(eventCache, 'get', key => cache.get(key));
  const password = await hashPassword('employee-password');
  const writes = [];
  let shift = null;
  const connection = {
    beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {},
    query: async () => [[]],
    execute: async (sql, params) => {
      if (sql.includes('SELECT u.password')) return [[{ stationId: '10', role: 'encargado', disponible: true }]];
      if (sql.includes('SELECT check_in_mode')) return [[{ kioskMode: true }]];
      if (sql.includes('SELECT u.id_usuario AS id')) return [[{
        id: '2', email: 'employee@example.com', password, disponible: true, stationId: '10', role: 'vendedor',
      }]];
      if (sql.includes('FROM horarios')) return [shift ? [shift] : []];
      if (sql.startsWith('INSERT INTO dias')) return [{}];
      writes.push({ sql, params });
      if (sql.startsWith('INSERT INTO horarios')) { shift = { id: '30', stationId: '10' }; return [{}]; }
      if (sql.startsWith('UPDATE horarios')) { shift = null; return [{}]; }
      assert.fail(`Consulta inesperada: ${sql}`);
    },
  };
  mock.method(db, 'getConnection', async () => connection);
  const manager = actor('encargado', { kioskMode: true });
  assert.deepEqual(await kioskService.event(manager), { open: false, attendanceOpen: true, date: '2000-01-01' });
  const input = { userId: '2', email: 'employee@example.com', password: 'employee-password' };
  assert.deepEqual(await kioskService.mark(manager, { ...input, action: 'check-in', attendanceId: null }), { working: true });
  assert.deepEqual(await kioskService.mark(manager, { ...input, action: 'check-out', attendanceId: '30' }), { working: false });
  assert.equal(writes.length, 2);
  assert.deepEqual(writes[1].params, ['30']);
  assert(!writes[1].sql.includes('SET id_dias'), 'la salida no cambia el día original del turno');
});
