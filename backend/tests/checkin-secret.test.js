import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { env } from '../src/config/env.js';
import { encryptCheckInPassword, decryptCheckInPassword } from '../src/security/checkin-secret.js';
import { createCheckIn, updateCheckIn } from '../src/modules/users/users.schemas.js';
import { requireCheckIn } from '../src/modules/attendance/kiosk.service.js';
import { db } from '../src/config/database.js';

after(() => db.end());

test('contraseñas Check-in cifradas no se pueden intercambiar ni alterar', () => {
  const password = 'Check-in-password-1234';
  const encrypted = encryptCheckInPassword(password, '12');
  assert.notEqual(encrypted, password);
  assert.notEqual(encrypted, encryptCheckInPassword(password, '12'));
  assert.equal(decryptCheckInPassword(encrypted, '12'), password);
  assert.throws(() => decryptCheckInPassword(encrypted, '13'));
  const parts = encrypted.split('.');
  const bytes = Buffer.from(parts[2], 'base64url');
  bytes[0] ^= 1;
  parts[2] = bytes.toString('base64url');
  assert.throws(() => decryptCheckInPassword(parts.join('.'), '12'));
});

test('crear Check-in requiere configurar cifrado; no admite puesto ni rol del cliente', () => {
  const previous = env.DATA_ENCRYPTION_KEY;
  try {
    env.DATA_ENCRYPTION_KEY = undefined;
    assert.throws(() => encryptCheckInPassword('clave', '1'), { status: 503 });
  } finally { env.DATA_ENCRYPTION_KEY = previous; }
  const input = { email: 'kiosk@example.com', password: 'Check-in-password-1234' };
  assert.equal(createCheckIn.safeParse(input).success, true);
  for (const extra of [{ stationId: '2' }, { roleId: '1' }, { firstName: 'Nombre' }])
    assert.equal(createCheckIn.safeParse({ ...input, ...extra }).success, false);
  assert.equal(updateCheckIn.safeParse({ userId: '1', email: input.email }).success, true);
  assert.equal(updateCheckIn.safeParse({ userId: '1', ...input, stationId: '2' }).success, false);
  for (const role of ['dueno', 'encargado', 'secretario', 'camarografo', 'vendedor', 'cliente'])
    assert.throws(() => requireCheckIn({ role, stationId: '1' }), { status: 403 });
  requireCheckIn({ role: 'checkin', stationId: null });
});
