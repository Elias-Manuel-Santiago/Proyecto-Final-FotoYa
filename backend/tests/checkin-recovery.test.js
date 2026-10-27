import test, { after, afterEach, mock } from 'node:test';
import assert from 'node:assert/strict';
import { kioskService } from '../src/modules/attendance/kiosk.service.js';
import { db } from '../src/config/database.js';
import { hashPassword } from '../src/security/crypto.js';

after(() => db.end());
afterEach(() => mock.restoreAll());
const password = 'Manager-password-1234';
const hash = await hashPassword(password);
const actor = { id: '7', sessionId: '12', role: 'encargado', stationId: '3', kioskMode: false };

function setup({ active = true, failPromotion = false } = {}) {
  const state = { committed: false, rolledBack: false, writes: [] };
  const connection = {
    beginTransaction: async () => {},
    commit: async () => { state.committed = true; },
    rollback: async () => { state.rolledBack = true; },
    release: () => {},
    query: async () => [[]],
    execute: async (sql, params) => {
      if (sql.includes('SELECT u.password')) return [[{ password: hash, disponible: true, role: actor.role, stationId: actor.stationId }]];
      if (sql.includes('SELECT check_in_mode')) return [[{ kioskMode: false }]];
      if (sql.includes('SELECT disponible FROM puesto')) return [[{ disponible: active }]];
      if (sql.includes('UPDATE sesiones_usuario')) {
        state.writes.push({ sql, params });
        if (failPromotion && sql.includes('SET check_in_mode = TRUE')) throw new Error('Promotion failed');
        return [{}];
      }
      throw new Error(`Unexpected query: ${sql}`);
    },
  };
  mock.method(db, 'getConnection', async () => connection);
  return state;
}

test('recuperar revoca solo kioscos del encargado y activa la sesión actual en una transacción', async () => {
  const state = setup();
  assert.deepEqual(await kioskService.recover(actor, { password }), { kioskMode: true });
  assert.equal(state.committed, true);
  assert.equal(state.rolledBack, false);
  assert.equal(state.writes.length, 2);
  assert.match(state.writes[0].sql, /id_usuario = \? AND check_in_mode = TRUE/);
  assert.deepEqual(state.writes[0].params, [actor.id]);
  assert.match(state.writes[1].sql, /SET check_in_mode = TRUE/);
  assert.deepEqual(state.writes[1].params, [actor.sessionId]);
});

test('contraseña incorrecta no libera el kiosco y conserva la sesión normal', async () => {
  const state = setup();
  await assert.rejects(kioskService.recover(actor, { password: 'wrong' }), { code: 'INVALID_CREDENTIALS' });
  assert.deepEqual(state.writes, []);
  assert.equal(state.rolledBack, true);
});

test('otro rol o puesto inactivo no puede recuperar un kiosco', async () => {
  for (const role of ['dueno', 'secretario', 'editor', 'cliente']) {
    const state = setup();
    await assert.rejects(kioskService.recover({ ...actor, role }, { password }), { status: 403 });
    assert.deepEqual(state.writes, []);
  }
  const state = setup({ active: false });
  await assert.rejects(kioskService.recover(actor, { password }), { code: 'STATION_REQUIRED' });
  assert.deepEqual(state.writes, []);
});

test('si falla la activación, la revocación anterior también se revierte', async () => {
  const state = setup({ failPromotion: true });
  await assert.rejects(kioskService.recover(actor, { password }), /Promotion failed/);
  assert.equal(state.rolledBack, true);
  assert.equal(state.committed, false);
});
