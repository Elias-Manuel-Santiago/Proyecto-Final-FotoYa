import { test, mock, after, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../../src/config/database.js';

let identity, sent;
mock.module('../../src/integrations/auth0.js', { namedExports: {
  socialIdentity: async () => identity,
} });
mock.module('../../src/integrations/mail.js', { namedExports: {
  sendVerification: async () => { sent++; },
} });
const { registrationService } = await import('../../src/modules/auth/registration.service.js');
afterEach(() => mock.restoreAll());
after(() => db.end());

function setup({ existing = false, emailMatch = false, verified = true, available = true, email = 'client@example.com', role = 'cliente', accountVerified = false } = {}) {
  identity = { subject: 'google-oauth2|123', email: 'client@example.com', emailVerified: verified };
  sent = 0;
  const state = { verified: accountVerified, sessions: 0, invalidated: false, inserted: null, sessionUser: null, revokedWorkSessions: false };
  mock.method(db, 'execute', async sql => [[(sql.includes('auth0_sub') ? existing : emailMatch) ? { id_usuario: 12 } : undefined]]);
  const connection = {
    beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {},
    query: async () => [[]],
    execute: async (sql, params) => {
      if (sql.includes('SELECT u.*')) return [[{ id_usuario: 12, role, auth0_sub: existing ? identity.subject : null, disponible: available, email_verified: state.verified, email }]];
      if (sql.includes('SELECT id_rol')) return [[{ id_rol: 6 }]];
      if (sql.includes('INSERT INTO usuarios')) { state.inserted = params; state.verified = params[6]; return [{ insertId: 12 }]; }
      if (sql.includes('SELECT sent_at')) return [[{ recent: false }]];
      if (sql.includes('UPDATE usuarios SET email_verified')) state.verified = true;
      else if (sql.includes('SET used_at')) state.invalidated = true;
      else if (sql.includes('UPDATE sesiones_usuario')) { assert.ok(sql.includes('check_in_mode = FALSE')); state.revokedWorkSessions = true; }
      else if (sql.includes('INSERT INTO sesiones_usuario')) { state.sessions++; state.sessionUser = params[0]; }
      else if (!sql.includes('INSERT INTO tokens_autenticacion')) throw new Error(`Unexpected SQL: ${sql}`);
      return [{}];
    },
  };
  mock.method(db, 'getConnection', async () => connection);
  return state;
}

test('verified provider creates an authenticated client without personal data or email delivery', async () => {
  const state = setup();
  const result = await registrationService.social({ idToken: 'signed' });
  assert.ok(result.token);
  assert.equal(result.verificationToken, undefined);
  assert.equal(state.verified, true);
  assert.deepEqual(state.inserted.slice(0, 4), ['', '', 'client@example.com', null]);
  assert.equal(state.sessions, 1);
  assert.equal(sent, 0);
});

test('pending social account signs in and invalidates old email challenges', async () => {
  const state = setup({ existing: true });
  assert.ok((await registrationService.social({ idToken: 'signed' })).token);
  assert.equal(state.verified, true);
  assert.equal(state.invalidated, true);
  assert.equal(sent, 0);
});

test('unverified provider still requires email confirmation', async () => {
  const state = setup({ verified: false });
  const result = await registrationService.social({ idToken: 'signed' });
  assert.ok(result.verificationToken);
  assert.equal(result.token, undefined);
  assert.equal(state.sessions, 0);
  assert.equal(sent, 1);
});

test('verified provider cannot confirm a different stored email', async () => {
  const state = setup({ existing: true, email: 'other@example.com' });
  assert.ok((await registrationService.social({ idToken: 'signed' })).verificationToken);
  assert.equal(state.verified, false);
  assert.equal(state.sessions, 0);
});

test('verified provider cannot reactivate a disabled account', async () => {
  const state = setup({ existing: true, available: false });
  await assert.rejects(registrationService.social({ idToken: 'signed' }), { status: 403 });
  assert.equal(state.verified, false);
  assert.equal(state.sessions, 0);
});

test('verified email reuses local accounts for every supported role without creating or replacing credentials', async () => {
  for (const role of ['cliente', 'dueno', 'encargado', 'secretario', 'vendedor', 'editor', 'camarografo']) {
    const state = setup({ emailMatch: true, email: 'Client@Example.com', role, accountVerified: true });
    assert.ok((await registrationService.social({ idToken: 'signed' })).token);
    assert.equal(state.sessionUser, 12);
    assert.equal(state.inserted, null);
    assert.equal(sent, 0);
    assert.equal(state.revokedWorkSessions, role === 'encargado');
    mock.restoreAll();
  }
});

test('verified email confirms an existing pending local account', async () => {
  const state = setup({ emailMatch: true });
  assert.ok((await registrationService.social({ idToken: 'signed' })).token);
  assert.equal(state.verified, true);
  assert.equal(state.invalidated, true);
  assert.equal(state.inserted, null);
});

test('different verified providers reuse the same account on repeated logins', async () => {
  const state = setup({ emailMatch: true, accountVerified: true });
  for (const provider of ['google-oauth2', 'github', 'apple', 'amazon']) {
    identity.subject = `${provider}|external-user`;
    assert.ok((await registrationService.social({ idToken: 'signed' })).token);
    assert.equal(state.sessionUser, 12);
  }
  assert.equal(state.sessions, 4);
  assert.equal(state.inserted, null);
});

test('known subject keeps its account when the provider email has changed', async () => {
  const state = setup({ existing: true, emailMatch: true, email: 'original@example.com', accountVerified: true });
  assert.ok((await registrationService.social({ idToken: 'signed' })).token);
  assert.equal(state.sessionUser, 12);
});

test('unverified email cannot access even an already verified matching account', async () => {
  const state = setup({ emailMatch: true, verified: false, accountVerified: true });
  await assert.rejects(registrationService.social({ idToken: 'signed' }), { code: 'SOCIAL_EMAIL_UNVERIFIED' });
  assert.equal(state.sessions, 0);
  assert.equal(sent, 0);
});

test('email matching revalidates the stored email under lock', async () => {
  const state = setup({ emailMatch: true, email: 'changed@example.com', accountVerified: true });
  await assert.rejects(registrationService.social({ idToken: 'signed' }), { status: 401 });
  assert.equal(state.sessions, 0);
});

test('email matching cannot bypass disabled or Check-in account restrictions', async () => {
  for (const options of [{ available: false }, { role: 'checkin' }]) {
    const state = setup({ emailMatch: true, ...options });
    await assert.rejects(registrationService.social({ idToken: 'signed' }), { status: 403 });
    assert.equal(state.sessions, 0);
    mock.restoreAll();
  }
});
