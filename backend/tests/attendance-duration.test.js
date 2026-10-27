import test, { mock, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/config/database.js';
import { defineDuration } from '../src/modules/attendance/attendance.duration.js';
import { durationInput } from '../src/modules/attendance/attendance.schemas.js';
import { actor } from './fixtures.js';

afterEach(() => mock.restoreAll());
after(() => db.end());
const secretary = actor('secretario', { permissions: ['attendance.read'], sessionId: '9' });
function setup({ authorized = true, checkOut = null, role = 'vendedor', missing = false } = {}) {
  let committed = false, rolledBack = false;
  const writes = [];
  const connection = {
    beginTransaction: async () => {}, commit: async () => { committed = true; }, rollback: async () => { rolledBack = true; }, release: () => {},
    execute: async (sql, values) => {
      if (sql.includes('JOIN sesiones_usuario')) return [authorized ? [{ id_usuario: '1' }] : []];
      if (sql.startsWith('SELECT h.id_horario')) return [missing ? [] : [{ id: '3', checkOut, role }]];
      assert.match(sql, /^UPDATE horarios SET manual_minutes=/);
      assert(!sql.includes('check_out='));
      writes.push(values);
      return [{ affectedRows: 1 }];
    },
  };
  mock.method(db, 'getConnection', async () => connection);
  return { writes, committed: () => committed, rolledBack: () => rolledBack };
}

test('secretary records reported hours and minutes with author and timestamp without changing checkout', async () => {
  const state = setup();
  const result = await defineDuration(secretary, { attendanceId: '3', hours: 7, minutes: 50 });
  assert.deepEqual(result, { id: '3', manualMinutes: 470 });
  assert.deepEqual(state.writes, [[470, secretary.id, '3']]);
  assert.equal(state.committed(), true);
});

test('only secretary can define a duration even when another role has attendance permission', () => {
  for (const role of ['dueno', 'encargado', 'editor', 'vendedor', 'cliente']) assert.throws(() => defineDuration(actor(role, { permissions: ['attendance.read'] }), { attendanceId: '3', hours: 1, minutes: 0 }), { status: 403 });
});

test('revoked authorization, real checkout and unavailable employee records cannot be overwritten', async () => {
  for (const [options, status] of [[{ authorized: false }, 403], [{ checkOut: '2026-10-26 20:00:00' }, 409], [{ role: 'dueno' }, 404], [{ role: 'cliente' }, 404], [{ missing: true }, 404]]) {
    const state = setup(options);
    await assert.rejects(defineDuration(secretary, { attendanceId: '3', hours: 1, minutes: 0 }), { status });
    assert.equal(state.writes.length, 0);
    assert.equal(state.rolledBack(), true);
    mock.restoreAll();
  }
});

test('duration input rejects fractions, negative amounts and invalid minute components', () => {
  for (const patch of [{ hours: -1 }, { hours: 1.5 }, { hours: 169 }, { minutes: 60 }, { hours: 0, minutes: 0 }, { minutes: '30' }]) assert.equal(durationInput.safeParse({ attendanceId: '3', hours: 7, minutes: 50, ...patch }).success, false);
  assert.equal(durationInput.safeParse({ attendanceId: '3', hours: 0, minutes: 1 }).success, true);
});
