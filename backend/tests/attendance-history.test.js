import test, { mock, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/config/database.js';
import { attendanceRepository } from '../src/modules/attendance/attendance.repository.js';
import { assertPermission } from '../src/security/access.js';
import { actor } from './fixtures.js';

afterEach(() => mock.restoreAll());
after(() => db.end());

test('owner and secretary can query full employee history without a station or period restriction', async () => {
  const queries = [];
  mock.method(db, 'execute', async (sql, values) => { queries.push({ sql, values }); return [[{ id: '1', date: '2020-01-01' }]]; });
  for (const role of ['dueno', 'secretario']) {
    const result = await attendanceRepository.employeeHistory(actor(role, { stationId: null, permissions: ['attendance.read'] }), { userId: '7', limit: 100, offset: 100 });
    assert.equal(result[0].date, '2020-01-01');
    const query = queries.at(-1);
    assert(!query.sql.includes('BETWEEN'));
    assert(!query.sql.includes('d.id_puesto = ?'));
    assert.match(query.sql, /h.id_usuario = \?/);
    assert.deepEqual(query.values, ['7', '100', '100']);
  }
});

test('other roles and removed attendance permissions cannot retrieve full employee history', () => {
  for (const role of ['encargado', 'vendedor', 'editor', 'cliente']) assert.throws(() => attendanceRepository.employeeHistory(actor(role, { permissions: ['attendance.read'] }), { userId: '7' }), { status: 403 });
  assert.throws(() => attendanceRepository.employeeHistory(actor('secretario'), { userId: '7' }), { status: 403 });
  assert.doesNotThrow(() => assertPermission(actor('secretario', { permissions: ['attendance.read'] }), 'attendance.read'));
  assert.throws(() => assertPermission(actor('secretario', { permissions: ['attendance.self'] }), 'attendance.self'), { status: 403 });
});

test('secretary period view includes every station and can filter an employee', async () => {
  mock.method(db, 'execute', async (sql, values) => {
    assert.match(sql, /d.fecha BETWEEN \? AND \?/);
    assert(!sql.includes('d.id_puesto = ?'));
    assert.deepEqual(values, ['2026-10-01', '2026-10-31', '7', '100', '0']);
    return [[]];
  });
  await attendanceRepository.query(actor('secretario', { stationId: null }), { from: '2026-10-01', to: '2026-10-31', userId: '7', limit: 100, offset: 0 });
});
