import { after, afterEach, before, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import { db } from '../src/config/database.js';
import { authRepository } from '../src/modules/auth/auth.repository.js';
import { authRoutes } from '../src/modules/auth/auth.routes.js';
import { errorHandler } from '../src/shared/errors.js';

let server, url;
const token = 't'.repeat(43);
const actor = role => ({ id: '17', sessionId: '8', role, stationId: null,
  permissions: [], working: false, kioskMode: false, checkInActive: false });
const post = (body, authenticated = true) => fetch(url, {
  method: 'POST', headers: { 'Content-Type': 'application/json',
    ...(authenticated ? { Authorization: `Bearer ${token}` } : {}) },
  body: JSON.stringify(body),
});

before(async () => {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes());
  app.use(errorHandler);
  server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  url = `http://127.0.0.1:${server.address().port}/api/auth/me/update`;
});
afterEach(() => mock.restoreAll());
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  await db.end();
});

test('todos los roles pueden cambiar su propio nombre sin jornada ni permisos de administración', async () => {
  let current, name;
  const writes = [];
  mock.method(authRepository, 'actor', async received => {
    assert.equal(received, token);
    return current;
  });
  mock.method(db, 'execute', async (sql, values) => {
    if (sql.startsWith('UPDATE')) {
      assert.equal(sql, 'UPDATE usuarios SET nombre = ?, apellido = ? WHERE id_usuario = ?');
      assert.deepEqual(values, ['María José', 'Pérez', '17']);
      writes.push(sql);
      name = { nombre: values[0], apellido: values[1] };
      return [{ affectedRows: 1 }];
    }
    assert.match(sql, /WHERE u.id_usuario = \?/);
    assert.deepEqual(values, ['17']);
    return [[{ id: current.id, ...name, roleId: '2', role: current.role,
      email: 'persona@example.com', dni: '12345678', stationId: null, active: true }]];
  });
  for (const role of ['dueno', 'secretario', 'encargado', 'editor', 'camarografo', 'vendedor', 'cliente']) {
    current = actor(role);
    const response = await post({ firstName: '  María José  ', lastName: ' Pérez ' });
    assert.equal(response.status, 200);
    const { data } = await response.json();
    assert.equal(data.firstName, 'María José');
    assert.equal(data.lastName, 'Pérez');
    assert.equal(data.role, role);
    assert.equal(data.email, 'persona@example.com');
    assert.deepEqual(data.permissions, []);
    assert.equal(data.working, false);
  }
  // No se escriben roles, puestos, credenciales ni revocaciones de sesiones.
  assert.equal(writes.length, 7);
});

test('rechaza campos ajenos al nombre y nombres vacíos o demasiado largos antes de escribir', async () => {
  mock.method(authRepository, 'actor', async () => actor('cliente'));
  mock.method(db, 'execute', () => assert.fail('No debe escribir ni consultar usuarios'));
  const valid = { firstName: 'Ana', lastName: 'Pérez' };
  for (const patch of [{ userId: '99' }, { id: '99' }, { roleId: '1' }, { stationId: '2' },
    { email: 'otro@example.com' }, { password: 'otra-clave' }, { active: false },
    { firstName: '' }, { lastName: '   ' }, { firstName: 'a'.repeat(101) },
    { lastName: 'a'.repeat(101) }, { firstName: null }]) {
    assert.equal((await post({ ...valid, ...patch })).status, 422);
  }
  assert.equal((await post({})).status, 422);
});

test('exige una sesión vigente y bloquea la edición desde el kiosco', async () => {
  const session = mock.method(authRepository, 'actor', async () => null);
  mock.method(db, 'execute', () => assert.fail('No debe escribir ni consultar usuarios'));
  const input = { firstName: 'Ana', lastName: 'Pérez' };
  assert.equal((await post(input, false)).status, 401);
  assert.equal((await post(input)).status, 401);
  session.mock.mockImplementation(async () => ({ ...actor('encargado'), kioskMode: true }));
  const response = await post(input);
  assert.equal(response.status, 403);
  assert.equal((await response.json()).error.code, 'KIOSK_LOCKED');
});
