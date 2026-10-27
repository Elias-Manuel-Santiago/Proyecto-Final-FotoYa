import test, { after, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/config/database.js';
import { locations } from '../src/modules/catalog/locations.service.js';
import { stations } from '../src/modules/catalog/stations.service.js';
import { migrateLocations } from '../scripts/lib/migrate-locations.js';
import { migrateDirections } from '../scripts/lib/migrate-directions.js';

afterEach(() => mock.restoreAll());
after(() => db.end());
const owner = { id: '1', sessionId: '1', role: 'dueno', permissions: ['stations.manage'] };

test('event creation and editing persist directions', async () => {
  for (const id of [undefined, '4']) {
    const state = connectionFor(sql => {
      if (sql.includes('WHERE nombre =') || sql.startsWith('SELECT id_puesto AS id')) return [[]];
      if (sql.startsWith('SELECT')) return [[{ id: 1 }]];
      return [{ insertId: 4, affectedRows: 1 }];
    });
    await locations.saveEvent(owner, { id, name: 'Evento', directions: 'Calle 123', cityId: '2', stationIds: [] });
    assert.equal(state.committed, true);
    const saved = state.writes.find(row => row.sql.includes('direccion'));
    assert.deepEqual(saved.values, ['Evento', 'Calle 123', id ?? '2']);
  }
});

test('directions migration preserves legacy addresses and can run again', async () => {
  const queries = [];
  const connection = { query: async sql => { queries.push(sql); return [[]]; } };
  await migrateDirections(connection, { hasColumn: async (table) => table === 'puesto' });
  assert.match(queries[0], /ALTER TABLE evento ADD direccion/);
  assert.match(queries[1], /HAVING COUNT\(DISTINCT TRIM\(direccion\)\) = 1/);
  assert.match(queries[2], /NULL DEFAULT NULL/);
  queries.length = 0;
  await migrateDirections(connection, { hasColumn: async () => true });
  assert.equal(queries.length, 2);
  queries.length = 0;
  await migrateDirections(connection, { hasColumn: async table => table === 'evento' });
  assert.equal(queries.length, 0);
});
function connectionFor(respond) {
  const writes = [];
  let committed = false, rolledBack = false;
  const connection = {
    beginTransaction: async () => {}, release: () => {},
    commit: async () => { committed = true; }, rollback: async () => { rolledBack = true; },
    query: async () => [[]],
    execute: async (sql, values) => {
      if (sql.includes('JOIN sesiones_usuario')) return [[{ id_usuario: 1 }]];
      if (/^(UPDATE|INSERT|DELETE)/.test(sql)) writes.push({ sql, values });
      return respond(sql, values);
    },
  };
  mock.method(db, 'getConnection', async () => connection);
  return { writes, get committed() { return committed; }, get rolledBack() { return rolledBack; } };
}

test('only the owner with stations.manage can mutate locations', async () => {
  for (const actor of [{ ...owner, role: 'secretario' }, { ...owner, permissions: [] }])
    assert.throws(() => locations.saveCity(actor, { name: 'Ciudad' }), { status: 403 });
});

test('cities with events and events with inactive stations cannot be deleted', async () => {
  for (const kind of ['city', 'event']) {
    const state = connectionFor(sql => {
      if (sql.startsWith('SELECT')) return [[{ id: 3 }]];
      assert.fail(sql);
    });
    await assert.rejects(locations.delete(owner, { kind, id: '3' }), { status: 409 });
    assert.equal(state.writes.length, 0);
    assert.equal(state.rolledBack, true);
  }
});

test('an empty event can be deleted after its references are checked', async () => {
  const state = connectionFor(sql => {
    if (sql.startsWith('SELECT id_evento FROM evento')) return [[{ id_evento: 3 }]];
    if (sql.startsWith('SELECT id_puesto')) return [[]];
    if (sql.startsWith('DELETE FROM evento')) return [{ affectedRows: 1 }];
    assert.fail(sql);
  });
  await locations.delete(owner, { kind: 'event', id: '3' });
  assert.equal(state.committed, true);
  assert.equal(state.writes.length, 1);
});

test('station creation saves its own name and derives the city from an existing event', async () => {
  const state = connectionFor((sql, values) => {
    if (sql.includes('FROM evento')) {
      assert.deepEqual(values, ['2']);
      return [[{ id: 2, name: 'Evento', cityId: 9 }]];
    }
    if (sql.startsWith('SELECT id_puesto')) return [[]];
    if (sql.startsWith('INSERT INTO puesto')) return [{ insertId: 3 }];
    assert.fail(sql);
  });
  assert.deepEqual(await stations.create(owner, { name: '  Entrada principal  ', eventId: '2' }), { id: '3', active: true });
  assert.equal(state.committed, true);
  assert.equal(state.writes.length, 1);
  assert.deepEqual(state.writes[0].values, ['Entrada principal', 9, 2]);
});

test('station creation rejects missing events without creating locations', async () => {
  const state = connectionFor(sql => {
    if (sql.includes('FROM evento')) return [[]];
    assert.fail(sql);
  });
  await assert.rejects(stations.create(owner, { name: 'Entrada', eventId: '999' }), { status: 404 });
  assert.equal(state.writes.length, 0);
  assert.equal(state.rolledBack, true);
});

test('station creation rejects duplicates including inactive stations', async () => {
  const state = connectionFor(sql => {
    if (sql.includes('FROM evento')) return [[{ id: 2, name: 'Evento', cityId: 9 }]];
    if (sql.startsWith('SELECT id_puesto')) return [[{ id_puesto: 3 }]];
    assert.fail(sql);
  });
  await assert.rejects(stations.create(owner, { name: '  Entrada principal  ', eventId: '2' }), { status: 409 });
  assert.equal(state.writes.length, 0);
  assert.equal(state.rolledBack, true);
});

test('employee transfer updates one assignment and revokes sessions atomically', async () => {
  const state = connectionFor(sql => {
    if (sql.includes('r.nombre AS role')) return [[{ stationId: 2, role: 'vendedor' }]];
    if (sql.includes('disponible AS active')) return [[{ active: 1 }]];
    if (sql.includes('FROM horarios')) return [[]];
    if (sql.startsWith('SELECT')) return [[{ id: 1 }]];
    return [{ affectedRows: 1 }];
  });
  await locations.updateStation(owner, { stationId: '1', name: 'Puesto', cityId: '3', eventId: null,
    employeeStations: [{ employeeId: '8', stationId: '1' }] });
  assert.equal(state.committed, true);
  assert.deepEqual(state.writes.find(row => row.sql.startsWith('UPDATE usuarios')).values, ['1', '8']);
  assert(state.writes.some(row => row.sql.startsWith('UPDATE sesiones_usuario')));
});

test('an employee with an open shift cannot be transferred; the station edit rolls back', async () => {
  const state = connectionFor(sql => {
    if (sql.includes('r.nombre AS role')) return [[{ stationId: 2, role: 'vendedor' }]];
    if (sql.includes('disponible AS active')) return [[{ active: 1 }]];
    if (sql.startsWith('SELECT')) return [[{ id: 1 }]];
    return [{ affectedRows: 1 }];
  });
  await assert.rejects(locations.updateStation(owner, { stationId: '1', name: 'Puesto', cityId: '3', eventId: null,
    employeeStations: [{ employeeId: '8', stationId: '1' }] }), { status: 409 });
  assert.equal(state.committed, false);
  assert.equal(state.rolledBack, true);
  assert(!state.writes.some(row => row.sql.startsWith('UPDATE usuarios')));
});

test('legacy migration stops before changing ambiguous event data', async () => {
  const queries = [];
  await assert.rejects(migrateLocations({ query: async sql => { queries.push(sql); return [[{ id_evento: 1 }]]; } },
    { hasColumn: async () => false }), /sin ciudad o compartidos/);
  assert.equal(queries.length, 1);
  assert(queries[0].startsWith('SELECT'));
});
