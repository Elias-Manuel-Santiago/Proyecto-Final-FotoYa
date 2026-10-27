/**
 * @file
 * Verifica bloqueo por jornada y kiosco. Documenta excepciones necesarias para perfil y check-
 * in.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { workAccess } from '../src/security/work-access.js';
import { mark } from '../src/modules/attendance/kiosk.schemas.js';

const check = (role, path, overrides = {}, auth = false) => {
  let allowed = false;
  workAccess({ actor: { role, ...overrides }, baseUrl: auth ? '/api/auth' : '/api', path }, {}, () => { allowed = true; });
  return allowed;
};
test('empleados fuera de jornada solo conservan acceso a su cuenta', () => {
  for (const role of ['editor', 'camarografo', 'vendedor']) {
    assert.equal(check(role, '/me', { working: false }, true), true);
    assert.equal(check(role, '/password/change', { working: false }, true), true);
    for (const path of ['/photos/query', '/sales/create', '/attendance/mine', '/catalog/query', '/users/query']) {
      assert.throws(() => check(role, path, { working: false }), { status: 403, code: 'CHECK_IN_REQUIRED' });
      assert.equal(check(role, path, { working: true }), true);
    }
  }
  for (const role of ['dueno', 'encargado', 'secretario', 'cliente']) assert.equal(check(role, '/photos/query'), true);
});
test('la sesión Check-in del encargado impide volver al sistema o cerrar sin contraseña', () => {
  const kiosk = { kioskMode: true };
  for (const path of ['/logout', '/sessions/revoke', '/password/change'])
    assert.throws(() => check('encargado', path, kiosk, true), { code: 'KIOSK_LOCKED' });
  for (const path of ['/users/query', '/sales/create', '/reports/query', '/attendance/kiosk/enter', '/attendance/kiosk/assign', '/attendance/kiosk/stations'])
    assert.throws(() => check('encargado', path, kiosk), { code: 'KIOSK_LOCKED' });
  assert.equal(check('encargado', '/me', kiosk, true), true);
  for (const path of ['/attendance/kiosk/exit', '/attendance/kiosk/employees', '/attendance/kiosk/mark', '/attendance/kiosk/event', '/attendance/kiosk/event/set'])
    assert.equal(check('encargado', path, kiosk), true);
  assert.equal(check('encargado', '/users/query', { kioskMode: false }), true);
});
test('marcaciones exigen credenciales, empleado y estado esperado; no aceptan hora o puesto del cliente', () => {
  const input = { userId: '1', email: 'empleado@example.com', password: 'clave', action: 'check-in', attendanceId: null };
  assert.equal(mark.safeParse(input).success, true);
  for (const invalid of [{ ...input, password: '' }, { ...input, attendanceId: undefined }, { ...input, stationId: '2' }, { ...input, checkIn: '2026-10-18' }])
    assert.equal(mark.safeParse(invalid).success, false);
});
