import test, { mock, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/config/database.js';
import { graphicsRepository } from '../src/modules/reports/graphics.repository.js';
import { actor } from './fixtures.js';

afterEach(() => mock.restoreAll());
after(() => db.end());

test('team graphics include camera operators as workers and retain their attributed production', async () => {
  const queries = [];
  const connection = {
    beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {},
    execute: async (sql, values) => {
      queries.push(sql);
      assert.equal((sql.match(/\?/g) ?? []).length, values.length);
      if (sql.includes('SELECT DISTINCT')) {
        assert.match(sql, /IN \('vendedor','camarografo','editor'\)/);
        return [[{ stationId: '1', employeeId: '7', role: 'cameraman', name: 'Cámara' }]];
      }
      if (sql.includes('f.id_camarografo AS employeeId')) {
        assert.match(sql, /WHEN r.nombre='camarografo' THEN 'cameraman'/);
        assert.match(sql, /LEFT JOIN rol r/);
        return [[{ stationId: '1', employeeId: '7', role: 'cameraman', name: 'Cámara', taken: 5, sales: 2, sold: 2, earnings: 100 }]];
      }
      return [[]];
    },
  };
  mock.method(db, 'getConnection', async () => connection);
  const result = await graphicsRepository.query(actor('dueno'), { from: '2026-10-01', to: '2026-10-31' });
  assert.equal(result.workers[0].role, 'cameraman');
  assert.equal(result.people[0].taken, 5);
  assert(queries.length > 3);
});
