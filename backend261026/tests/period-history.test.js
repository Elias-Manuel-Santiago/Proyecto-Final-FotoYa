import test, { mock, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/config/database.js';
import { period } from '../src/shared/validation.js';
import { salesRepository } from '../src/modules/sales/sales.repository.js';
import { attendanceRepository } from '../src/modules/attendance/attendance.repository.js';
import { reportsRepository } from '../src/modules/reports/reports.repository.js';
import { graphicsRepository } from '../src/modules/reports/graphics.repository.js';
import { graphicsQuery } from '../src/modules/reports/reports.routes.js';
import { actor } from './fixtures.js';

afterEach(() => mock.restoreAll());
after(() => db.end());

test('all period endpoints accept Siempre and continue validating bounded ranges', () => {
  assert.equal(period.parse({ allTime: true }).allTime, true);
  assert.equal(period.parse({ from: '2026-10-01', to: '2026-10-31' }).from, '2026-10-01');
  for (const value of [
    {}, { allTime: false }, { allTime: 'true' },
    { from: '2026-10-01' },
    { from: '2026-10-02', to: '2026-10-01' },
    { from: '2020-01-01', to: '2026-10-01' },
    { allTime: true, from: '2020-01-01', to: '2026-10-01' },
    { allTime: true, stationId: 'invalid' },
  ]) assert.equal(period.safeParse(value).success, false);
  assert.equal(graphicsQuery.safeParse({ allTime: true }).success, true);
  assert.equal(graphicsQuery.safeParse({ allTime: true, day: '2020-01-01' }).success, false);
});

test('sales, counts and attendance omit dates but keep the assigned station and pagination', async () => {
  const queries = [];
  mock.method(db, 'execute', async (sql, values) => {
    assert(!sql.includes('BETWEEN'));
    assert.match(sql, /d.id_puesto = \?/);
    assert.deepEqual(values, ['10', '100', '100']);
    queries.push(sql);
    return [[]];
  });
  const input = period.parse({ allTime: true, limit: 100, offset: 100 });
  await salesRepository.query(actor('encargado'), input);
  await reportsRepository.days(actor('encargado'), input);
  await attendanceRepository.query(actor('encargado'), input);
  assert.equal(queries.length, 3);
  for (const repository of [salesRepository, reportsRepository, attendanceRepository]) {
    const method = repository === reportsRepository ? 'days' : 'query';
    await assert.rejects(repository[method](actor('encargado'), { ...input, stationId: '99' }), { status: 403 });
  }
});

test('Siempre in personal attendance keeps employee ownership and historical stations', async () => {
  mock.method(db, 'execute', async (sql, values) => {
    assert(!sql.includes('BETWEEN'));
    assert(!sql.includes('d.id_puesto = ?'));
    assert.match(sql, /h.id_usuario = \?/);
    assert.deepEqual(values, ['7', '30', '0']);
    return [[]];
  });
  await attendanceRepository.query(actor('editor', { id: '7' }), period.parse({ allTime: true }), true);
});

test('Siempre report totals aggregate registered history and retain location filters', async () => {
  const queries = [];
  mock.method(db, 'execute', async (sql, values) => {
    assert(!sql.includes('BETWEEN'));
    assert(!sql.includes('DATEDIFF'));
    assert.match(sql, /a.registeredDays > 0/);
    assert.match(sql, /a.invalidDays = 0/);
    assert.match(sql, /p.id_puesto = \? AND p.id_ciudad = \? AND p.id_evento = \?/);
    assert.equal((sql.match(/\?/g) ?? []).length, values.length);
    queries.push(values);
    return [[{ taken: 100, sold: 60, revenue: 200 }]];
  });
  const input = { ...period.parse({ allTime: true, stationId: '10' }), cityId: '2', eventId: '3' };
  await reportsRepository.query(actor('dueno'), input);
  await reportsRepository.summary(actor('dueno'), input);
  assert.deepEqual(queries, [['10', '2', '3', '30', '0'], ['10', '2', '3']]);
});

test('Siempre graphics include full history in all aggregates while preserving station scope', async () => {
  const queries = [];
  const connection = {
    beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {},
    execute: async (sql, values) => {
      assert(!sql.includes('BETWEEN'));
      assert.match(sql, /d.id_puesto = \?/);
      assert.equal((sql.match(/\?/g) ?? []).length, values.length);
      assert.deepEqual(values, ['10']);
      queries.push(sql);
      return [[]];
    },
  };
  mock.method(db, 'getConnection', async () => connection);
  const result = await graphicsRepository.query(actor('encargado'), period.parse({ allTime: true }));
  assert.equal(queries.length, 5);
  assert.deepEqual(result.hours, []);
  assert.deepEqual(result.attendance, []);
  await assert.rejects(graphicsRepository.query(actor('encargado'), { allTime: true, stationId: '99' }), { status: 403 });
});
