import { test, mock, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { MailtrapClient } from 'mailtrap';
import { db } from '../src/config/database.js';
import { env } from '../src/config/env.js';
import { passwordResetService } from '../src/modules/auth/password-reset.service.js';
import { digest, codeDigest } from '../src/modules/auth/registration.service.js';
import { passwordResetStart, passwordResetConfirm } from '../src/modules/auth/auth.schemas.js';
import { verifyPassword } from '../src/security/crypto.js';
import { createApp } from '../src/app.js';

const mailConfig = { MAIL_API_KEY: env.MAIL_API_KEY, MAIL_INBOX_ID: env.MAIL_INBOX_ID, SENDER: env.SENDER };
afterEach(() => { mock.restoreAll(); Object.assign(env, mailConfig); });
after(() => db.end());
const newPassword = 'Recovered-password-1234';

function recoveryDb(userChanges = {}) {
  let snapshot;
  const state = {
    user: { id_usuario: '12', email: 'ana@example.com', password: 'old-hash', disponible: 1, auth0_sub: null, role: 'cliente', email_verified: 0, ...userChanges },
    tokens: [], recent: false, sessionsRevoked: false, mail: [], commits: 0, rollbacks: 0,
    mailFailure: false, writeFailure: false,
  };
  Object.assign(env, { MAIL_API_KEY: 'test-token', MAIL_INBOX_ID: '123', SENDER: 'test@example.com' });
  mock.method(MailtrapClient.prototype, 'send', async message => {
    if (state.mailFailure) throw new Error('Simulated provider failure');
    state.mail.push(message);
    return { success: true };
  });
  const connection = {
    beginTransaction: async () => { snapshot = structuredClone({ user: state.user, tokens: state.tokens, sessionsRevoked: state.sessionsRevoked }); },
    commit: async () => { state.commits++; },
    rollback: async () => { Object.assign(state, snapshot); state.rollbacks++; },
    release: () => {},
    execute: async (sql, params) => {
      if (sql.includes('FROM usuarios u WHERE u.email')) return [[state.user?.email === params[0] ? state.user : undefined]];
      if (sql.includes('SELECT sent_at')) return [[state.tokens.length ? { recent: state.recent } : undefined]];
      if (sql.includes('SELECT id_usuario FROM tokens_autenticacion')) return [[state.tokens.some(row => row.token === params[0] && row.tipo === 'password_reset' && !row.used) ? { id_usuario: '12' } : undefined]];
      if (sql.includes('FROM usuarios u WHERE u.id_usuario')) return [[state.user]];
      if (sql.includes('SELECT *, expires_at')) return [[state.tokens.find(row => row.token === params[0] && row.tipo === 'password_reset' && !row.used)]];
      if (sql.includes('INSERT INTO tokens_autenticacion')) {
        state.tokens.push({ id_tokens: state.tokens.length + 1, tipo: 'password_reset', token: params[1], code_hash: params[2], attempts: 0, valid: 1, used: false });
      } else if (sql.includes('attempts = attempts + 1')) state.tokens.find(row => row.id_tokens === params[0]).attempts++;
      else if (sql.includes('UPDATE usuarios SET password')) state.user.password = params[0];
      else if (sql.includes('UPDATE sesiones_usuario')) {
        if (state.writeFailure) throw new Error('Simulated database failure');
        state.sessionsRevoked = true;
      } else if (sql.includes('UPDATE tokens_autenticacion SET used_at')) {
        for (const row of state.tokens) if (!sql.includes("tipo = 'password_reset'") || row.tipo === 'password_reset') row.used = true;
      } else assert.fail(`SQL inesperado: ${sql}`);
      return [{}];
    },
  };
  mock.method(db, 'getConnection', async () => connection);
  const start = () => passwordResetService.start({ email: ' ANA@example.com ' });
  const code = () => /\b\d{6}\b/.exec(state.mail.at(-1).text)[0];
  const confirm = (value, sentCode = code()) => passwordResetService.confirm({ recoveryToken: value.recoveryToken, code: sentCode, password: newPassword });
  return { state, start, code, confirm };
}

test('los contratos de recuperación exigen email, seis dígitos, desafío y contraseña de 12 a 128 caracteres', () => {
  assert(passwordResetStart.safeParse({ email: 'ana@example.com' }).success);
  const input = { recoveryToken: 'A'.repeat(43), code: '012345', password: newPassword };
  assert(passwordResetConfirm.safeParse(input).success);
  for (const extra of [{ code: '12345' }, { code: 'abcdef' }, { recoveryToken: 'bad' }, { password: 'short' }, { password: 'a'.repeat(129) }, { userId: '12' }])
    assert.equal(passwordResetConfirm.safeParse({ ...input, ...extra }).success, false);
});

test('Mailtrap recibe seis dígitos y la API y la persistencia sólo entregan/guardan sus valores permitidos', async () => {
  const { state, start, code } = recoveryDb();
  const response = await start();
  assert.deepEqual(Object.keys(response), ['recoveryToken', 'email', 'expiresIn']);
  assert.match(response.recoveryToken, /^[\w-]{43}$/);
  assert.equal(response.email, 'ana@example.com'); assert.equal(response.expiresIn, 600);
  assert.match(state.mail[0].subject, /contraseña/);
  assert.equal(state.mail[0].to[0].email, response.email);
  assert.equal(state.tokens[0].token, digest(response.recoveryToken));
  assert.equal(state.tokens[0].code_hash, codeDigest(response.recoveryToken, code()));
  assert(!JSON.stringify(response).includes('code'));
});

test('reenvío espera un minuto, reemplaza el desafío e invalida el código anterior', async () => {
  const { state, start, code, confirm } = recoveryDb();
  const first = await start(), firstCode = code();
  state.recent = true;
  const ignored = await start();
  assert.equal(state.mail.length, 1); assert.equal(state.tokens[0].used, false);
  await assert.rejects(confirm(ignored, firstCode), { code: 'INVALID_CODE' });
  state.recent = false;
  const second = await start();
  assert.notEqual(first.recoveryToken, second.recoveryToken);
  assert.equal(state.mail.length, 2); assert.equal(state.tokens[0].used, true);
  await assert.rejects(confirm(first, firstCode), { code: 'INVALID_CODE' });
  assert.deepEqual(await confirm(second), { changed: true, loginRequired: true });
});

test('cinco códigos erróneos persisten los intentos y bloquean también el código correcto', async () => {
  const { state, start, code, confirm } = recoveryDb();
  const response = await start();
  const wrong = code() === '000000' ? '111111' : '000000';
  for (let attempt = 0; attempt < 5; attempt++) await assert.rejects(confirm(response, wrong), { code: 'INVALID_CODE' });
  assert.equal(state.tokens[0].attempts, 5); assert.equal(state.commits, 6);
  await assert.rejects(confirm(response), { code: 'INVALID_CODE' });
  assert.equal(state.user.password, 'old-hash'); assert.equal(state.sessionsRevoked, false);
});

test('éxito guarda scrypt, revoca sesiones y todos los tokens sin verificar el email ni permitir reutilización', async () => {
  const { state, start, confirm } = recoveryDb();
  const response = await start();
  state.tokens.push({ tipo: 'email_verification', token: 'unrelated', used: false });
  await confirm(response);
  assert(await verifyPassword(newPassword, state.user.password));
  assert.equal(state.sessionsRevoked, true); assert(state.tokens.every(row => row.used));
  assert.equal(state.user.email_verified, 0);
  await assert.rejects(confirm(response), { code: 'INVALID_CODE' });
});

test('rechaza códigos vencidos y tokens de verificación de correo', async () => {
  const { state, start, confirm } = recoveryDb();
  const response = await start();
  state.tokens[0].valid = 0;
  await assert.rejects(confirm(response), { code: 'INVALID_CODE' });
  state.tokens[0].valid = 1; state.tokens[0].tipo = 'email_verification';
  await assert.rejects(confirm(response), { code: 'INVALID_CODE' });
  assert.equal(state.user.password, 'old-hash');
});

test('cuentas inexistentes, sociales, inactivas y Check-in reciben igual respuesta sin correo ni tokens', async () => {
  for (const changes of [{ email: 'other@example.com' }, { auth0_sub: 'google-oauth2|12' }, { disponible: 0 }, { role: 'checkin' }]) {
    const { state, start } = recoveryDb(changes);
    const response = await start();
    assert.deepEqual(Object.keys(response), ['recoveryToken', 'email', 'expiresIn']);
    assert.equal(state.mail.length, 0); assert.equal(state.tokens.length, 0);
    mock.restoreAll();
  }
});

test('dar de baja una cuenta entre el envío y la confirmación impide el cambio', async () => {
  const { state, start, confirm } = recoveryDb();
  const response = await start();
  state.user.disponible = 0;
  await assert.rejects(confirm(response), { code: 'INVALID_CODE' });
  assert.equal(state.user.password, 'old-hash');
});

test('un fallo de Mailtrap conserva el desafío anterior y no expone errores del proveedor', async () => {
  const { state, start, confirm } = recoveryDb();
  const response = await start();
  state.mailFailure = true;
  await assert.rejects(start(), { code: 'MAIL_UNAVAILABLE', status: 502 });
  assert.equal(state.rollbacks, 1); assert.equal(state.tokens.length, 1); assert.equal(state.tokens[0].used, false);
  await confirm(response);
});

test('un fallo al revocar sesiones revierte también el cambio de contraseña y conserva el código', async () => {
  const { state, start, confirm } = recoveryDb();
  const response = await start();
  state.writeFailure = true;
  await assert.rejects(confirm(response), /Simulated database failure/);
  assert.equal(state.user.password, 'old-hash'); assert.equal(state.tokens[0].used, false);
  state.writeFailure = false;
  await confirm(response);
});

test('las rutas de recuperación son públicas, validan el cuerpo y delegan sin emitir sesión', async t => {
  const starts = mock.method(passwordResetService, 'start', async input => ({ recoveryToken: 'A'.repeat(43), email: input.email, expiresIn: 600 }));
  const confirms = mock.method(passwordResetService, 'confirm', async () => ({ changed: true, loginRequired: true }));
  const server = createApp().listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  const post = async (step, body) => fetch(`http://127.0.0.1:${server.address().port}/api/auth/password/reset/${step}`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
  });
  assert.equal((await post('start', { email: 'ana@example.com' })).status, 200);
  assert.equal((await post('start', { email: 'bad' })).status, 422);
  assert.equal(starts.mock.callCount(), 1);
  const body = { recoveryToken: 'A'.repeat(43), code: '012345', password: newPassword };
  const confirmed = await post('confirm', body);
  assert.equal(confirmed.status, 200);
  assert.deepEqual((await confirmed.json()).data, { changed: true, loginRequired: true });
  assert.equal((await post('confirm', { ...body, code: '123' })).status, 422);
  assert.equal(confirms.mock.callCount(), 1);
});
