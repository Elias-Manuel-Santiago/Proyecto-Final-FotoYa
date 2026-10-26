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

function setup({ existing = false, verified = true, available = true, email = 'client@example.com' } = {}) {
  identity = { subject: 'google-oauth2|123', email: 'client@example.com', emailVerified: verified };
  sent = 0;
  const state = { verified: false, sessions: 0, invalidated: false, inserted: null };
  mock.method(db, 'execute', async sql => [[sql.includes('auth0_sub') && existing ? { id_usuario: 12 } : undefined]]);
  const connection = {
    beginTransaction: async () => {}, commit: async () => {}, rollback: async () => {}, release: () => {},
    execute: async (sql, params) => {
      if (sql.includes('SELECT u.*')) return [[{ id_usuario: 12, role: 'cliente', disponible: available, email_verified: state.verified, email }]];
      if (sql.includes('SELECT id_rol')) return [[{ id_rol: 6 }]];
      if (sql.includes('INSERT INTO usuarios')) { state.inserted = params; state.verified = params[6]; return [{ insertId: 12 }]; }
      if (sql.includes('SELECT sent_at')) return [[{ recent: false }]];
      if (sql.includes('UPDATE usuarios SET email_verified')) state.verified = true;
      else if (sql.includes('SET used_at')) state.invalidated = true;
      else if (sql.includes('INSERT INTO sesiones_usuario')) state.sessions++;
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
