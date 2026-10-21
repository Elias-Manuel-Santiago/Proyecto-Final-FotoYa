import { test, mock, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { SignJWT, generateKeyPair } from 'jose';
import { env } from '../src/config/env.js';
import { db } from '../src/config/database.js';
import { verifySocialToken } from '../src/integrations/auth0.js';
import { registrationService, digest, codeDigest } from '../src/modules/auth/registration.service.js';
import { register, social } from '../src/modules/auth/auth.schemas.js';
import { clientQuery } from '../src/modules/users/clients.routes.js';

afterEach(() => mock.restoreAll());
after(() => db.end());
test('registro público fija cliente sin aceptar rol, puesto, disponibilidad ni identidad suministrada por el usuario', () => {
  const input = { firstName: 'Ana', lastName: 'Pérez', email: 'ana@example.com', dni: '12.345.678', password: 'Password-123456' };
  assert.equal(register.parse(input).dni, '12345678');
  for (const extra of [{ roleId: '1' }, { stationId: '1' }, { active: true }, { email_verified: true }])
    assert.equal(register.safeParse({ ...input, ...extra }).success, false);
  assert.equal(social.safeParse({ idToken: 'signed', email: 'forged@example.com' }).success, false);
  assert.equal(clientQuery.safeParse({ offset: 1 }).success, false);
  assert.equal(clientQuery.safeParse({ limit: 100 }).success, false);
});

test('Auth0 rechaza firma falsa, issuer, audience, vencimiento y proveedores distintos de los autorizados', async () => {
  const previous = { AUTH0_DOMAIN: env.AUTH0_DOMAIN, AUTH0_CLIENT_IDS: env.AUTH0_CLIENT_IDS };
  Object.assign(env, { AUTH0_DOMAIN: 'test.auth0.com', AUTH0_CLIENT_IDS: 'native,web' });
  try {
    const { privateKey, publicKey } = await generateKeyPair('RS256');
    const alien = await generateKeyPair('RS256');
    const token = (claims = {}, key = privateKey) => new SignJWT({ sub: 'google-oauth2|123', email: 'ANA@example.com', ...claims })
      .setProtectedHeader({ alg: 'RS256' }).setIssuer('https://test.auth0.com/').setAudience('web')
      .setIssuedAt().setExpirationTime('5m').sign(key);
    assert.deepEqual(await verifySocialToken(await token(), publicKey), { subject: 'google-oauth2|123', email: 'ana@example.com' });
    for (const value of [await token({}, alien.privateKey),
      await new SignJWT({ sub: 'github|123', email: 'a@example.com' }).setProtectedHeader({ alg: 'RS256' }).setIssuer('https://evil.example/').setAudience('web').setIssuedAt().setExpirationTime('5m').sign(privateKey),
      await new SignJWT({ sub: 'github|123', email: 'a@example.com' }).setProtectedHeader({ alg: 'RS256' }).setIssuer('https://test.auth0.com/').setAudience('other').setIssuedAt().setExpirationTime('5m').sign(privateKey),
      await new SignJWT({ sub: 'github|123', email: 'a@example.com' }).setProtectedHeader({ alg: 'RS256' }).setIssuer('https://test.auth0.com/').setAudience('web').setIssuedAt().setExpirationTime(1).sign(privateKey),
      await token({ sub: 'auth0|123' }), await token({ email: null })])
      await assert.rejects(verifySocialToken(value, publicKey), { code: 'INVALID_SOCIAL_IDENTITY' });
  } finally { Object.assign(env, previous); }
});

function verificationDb({ available = true, valid = true } = {}) {
  const token = 'A'.repeat(43), code = '123456';
  const state = { attempts: 0, verified: false, deleted: false, sessions: 0, commits: 0 };
  const connection = { beginTransaction: async () => {}, rollback: async () => {}, release: () => {},
    commit: async () => { state.commits++; },
    execute: async (sql, params) => {
      if (sql.includes('SELECT u.*')) return [[state.deleted || params[0] !== digest(token) ? undefined : { id_usuario: '12', disponible: available, email_verified: state.verified }]];
      if (sql.includes('SELECT *, expires_at')) return [[{ valid, attempts: state.attempts, code_hash: codeDigest(token, code) }]];
      if (sql.includes('attempts = attempts + 1')) state.attempts++;
      else if (sql.includes('SET email_verified')) state.verified = true;
      else if (sql.includes('DELETE FROM client_verifications')) state.deleted = true;
      else if (sql.includes('INSERT INTO sesiones_usuario')) state.sessions++;
      else throw new Error(`SQL inesperado: ${sql}`);
      return [{}];
    } };
  mock.method(db, 'getConnection', async () => connection);
  return { state, token, code };
}
test('código incorrecto consume intentos persistidos; cinco fallos bloquean incluso el código correcto', async () => {
  const { state, token, code } = verificationDb();
  for (let attempt = 0; attempt < 5; attempt++)
    await assert.rejects(registrationService.verify({ verificationToken: token, code: '000000' }), { code: 'INVALID_CODE' });
  assert.equal(state.attempts, 5); assert.equal(state.commits, 5);
  await assert.rejects(registrationService.verify({ verificationToken: token, code }), { code: 'INVALID_CODE' });
  assert.equal(state.sessions, 0);
});
test('confirmación emite una sola sesión y no permite reutilizar el código', async () => {
  const { state, token, code } = verificationDb();
  assert.match((await registrationService.verify({ verificationToken: token, code })).token, /^[\w-]{43}$/);
  assert.equal(state.verified, true); assert.equal(state.sessions, 1);
  await assert.rejects(registrationService.verify({ verificationToken: token, code }), { code: 'INVALID_CODE' });
});
test('una cuenta dada de baja o un código vencido nunca reciben sesión', async () => {
  for (const options of [{ available: false }, { valid: false }]) {
    const { token, code, state } = verificationDb(options);
    await assert.rejects(registrationService.verify({ verificationToken: token, code }), { code: 'INVALID_CODE' });
    assert.equal(state.sessions, 0);
    mock.restoreAll();
  }
});
