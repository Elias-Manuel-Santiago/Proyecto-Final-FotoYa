import test from 'node:test';
import assert from 'node:assert/strict';
import { hashPassword, verifyPassword, newToken } from '../src/security/crypto.js';
import { assertPermission, stationScope, assertAssignable } from '../src/security/access.js';
import { loadEnv } from '../src/config/env.js';
import { period } from '../src/shared/validation.js';
import { env, actor } from './fixtures.js';

test('scrypt usa sal y rechaza contraseñas incorrectas o formatos desconocidos', async () => {
  const password = 'A-valid-test-password', encoded = await hashPassword(password);
  assert(!encoded.includes(password));
  assert.equal(await verifyPassword(password, encoded), true);
  assert.equal(await verifyPassword('wrong', encoded), false);
  assert.equal(await verifyPassword(password, password), false);
  assert.notEqual(encoded, await hashPassword(password));
});
test('tokens aleatorios se utilizan sin hash', () => {
  const token = newToken();
  assert.match(token, /^[\w-]{43}$/);
  assert.notEqual(token, newToken());
});

test('alcance nulo de cliente/empleado no habilita acceso global', () => {
  assert.equal(stationScope(actor('dueno')), null);
  assert.equal(stationScope(actor('secretario'), '99'), '99');
  assert.equal(stationScope(actor('encargado')), '10');
  assert.throws(() => stationScope(actor('encargado'), '11'), { status: 403 });
  assert.throws(() => stationScope(actor('cliente', { stationId: null })), { status: 403 });
  assert.throws(() => assertPermission(actor('dueno'), 'photos.upload'), { status: 403 });
  assert.throws(() => assertAssignable(actor('encargado'), 'dueno', '10'), { status: 403 });
  assert.throws(() => assertAssignable(actor('encargado'), 'vendedor', '11'), { status: 403 });
});
test('validación rechaza fechas falsas, períodos invertidos e identificadores maliciosos', () => {
  const base = { from: '2026-10-14', to: '2026-10-15' };
  assert.equal(period.safeParse(base).success, true);
  for (const input of [{ ...base, from: '2026-02-30' }, { ...base, to: '2026-10-01' },
    { ...base, stationId: '1 OR 1=1' }, { ...base, limit: 101 }, { ...base, to: '2028-01-01' }])
    assert.equal(period.safeParse(input).success, false);
});
test('configuración no requiere claves de cifrado ni de búsqueda para ejecutar la API', () => {
  const { DATA_ENCRYPTION_KEY, LOOKUP_HASH_KEY, ...config } = { ...env, CORS_ORIGINS: env.CORS_ORIGINS.join(',') };
  assert.equal(loadEnv(config).SESSION_HOURS, 8);
  assert.equal(loadEnv({ ...config, DATA_ENCRYPTION_KEY: 'unused', LOOKUP_HASH_KEY: 'unused' }).DATA_ENCRYPTION_KEY, undefined);
});
