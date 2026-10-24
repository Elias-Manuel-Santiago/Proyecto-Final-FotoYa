import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { requireCheckIn } from '../src/modules/attendance/kiosk.service.js';
import { empty, exit } from '../src/modules/attendance/kiosk.schemas.js';
import { db } from '../src/config/database.js';

after(() => db.end());

test('solo la sesión en modo Check-in del encargado puede operar asistencia', () => {
  for (const role of ['dueno', 'secretario', 'camarografo', 'vendedor', 'cliente', 'checkin']) {
    for (const kioskMode of [false, true])
      assert.throws(() => requireCheckIn({ role, kioskMode }), { status: 403 });
  }
  assert.throws(() => requireCheckIn({ role: 'encargado', kioskMode: false }), { status: 403 });
  requireCheckIn({ role: 'encargado', kioskMode: true });
});

test('activar no permite elegir cuenta, puesto o modo; cerrar requiere contraseña', () => {
  assert.equal(empty.safeParse({}).success, true);
  for (const input of [{ stationId: '2' }, { userId: '2' }, { kioskMode: false }])
    assert.equal(empty.safeParse(input).success, false);
  assert.equal(exit.safeParse({ password: 'contraseña' }).success, true);
  for (const input of [{}, { password: '' }, { password: 'contraseña', kioskMode: false }])
    assert.equal(exit.safeParse(input).success, false);
});
