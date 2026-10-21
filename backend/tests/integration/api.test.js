/**
 * @file
 * Recorre la API con MySQL temporal al habilitar TEST_DB_PORT. Simula Storage, correo e
 * identidad y elimina sólo su base aleatoria.
 */
import { after, before, test, mock } from 'node:test';
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import axios from 'axios';
import { randomBytes, randomUUID, createCipheriv } from 'node:crypto';
import { migrate } from '../../scripts/migrate.js';
import { hashPassword, verifyPassword, newToken } from '../../src/security/crypto.js';
import { env as fixture } from '../fixtures.js';
import { ApiError } from '../../src/shared/errors.js';

// Crea y elimina exclusivamente una base nueva con nombre aleatorio; nunca usa DB_NAME.
const enabled = process.env.TEST_DB_PORT, integration = (name, fn) => test(name, { skip: !enabled }, fn);
const database = `foto_ya_test_${randomBytes(6).toString('hex')}`;
const env = { ...fixture, DB_NAME: database, DB_PORT: Number(enabled ?? 33307), DB_HOST: process.env.TEST_DB_HOST ?? '127.0.0.1',
  DB_USER: process.env.TEST_DB_USER ?? 'root', DB_PASSWORD: process.env.TEST_DB_PASSWORD ?? '' };
let admin, db, server, http, passwordHash, authRepository, photoUploads, businessDate, reconcilePhotoUploads;
const users = {}, tokens = {};
const objects = new Map(), storageCalls = { uploads: 0 };
let failureMode = null;
const verificationMail = [];
let mailFailure = false;
const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aK1cAAAAASUVORK5CYII=', 'base64');
const storage = {
  signedUrl: async file => ({ url: `https://private.example/${file}`, expiresIn: 60 }),
  remove: async file => { objects.delete(file); },
  upload: async (file, bytes) => {
    storageCalls.uploads++;
    if (failureMode === 'before') throw new ApiError(502, 'Fallo de prueba de Storage.');
    objects.set(file, bytes);
    if (failureMode === 'after') throw new ApiError(502, 'Timeout simulado tras almacenar el archivo.');
  },
};
const period = { from: '2026-10-14', to: '2026-10-14' };
const call = (path, input = {}, role = 'dueno') => http.post(`/api/${path}`, input, {
  headers: tokens[role] ? { Authorization: `Bearer ${tokens[role]}` } : {},
});
const upload = (operationId, clientId, overrides = {}) => {
  const form = new FormData();
  form.set('operationId', operationId); form.set('stationId', overrides.stationId ?? '1');
  if (clientId !== undefined) form.set('clientId', clientId);
  form.set('photo', new Blob([overrides.bytes ?? png], { type: 'image/png' }), 'photo.png');
  return call('photos/upload', form, overrides.role ?? 'encargado');
};

before(async () => {
  if (!enabled) return;
  admin = await mysql.createConnection({ host: env.DB_HOST, port: env.DB_PORT, user: env.DB_USER, password: env.DB_PASSWORD });
  await admin.query(`CREATE DATABASE \`${database}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
  const { env: runtimeEnv } = await import('../../src/config/env.js');
  Object.assign(runtimeEnv, env);
  ({ db } = await import('../../src/config/database.js'));
  // La suite supera el cupo de un minuto: conservar el middleware sin limitar los casos funcionales.
  const { rateLimit: realRateLimit } = await import('express-rate-limit');
  mock.module('express-rate-limit', { namedExports: { rateLimit: options => realRateLimit({ ...options, limit: 10000 }) } });
  mock.module('../../src/integrations/storage.js', { namedExports: {
    uploadFile: storage.upload, removeFile: storage.remove, signedUrl: storage.signedUrl, signedPreviewUrl: storage.signedUrl,
  } });
  mock.module('../../src/integrations/mail.js', { namedExports: { sendVerification: async (email, code) => {
    if (mailFailure) throw new ApiError(502, 'Correo no disponible.', 'MAIL_UNAVAILABLE');
    verificationMail.push({ email, code });
  } } });
  mock.module('../../src/integrations/auth0.js', { namedExports: { socialIdentity: async idToken => ({
    subject: `google-oauth2|${idToken}`, email: idToken === 'owner' ? 'dueno@example.com' : `${idToken}@social.example.com`,
  }) } });
  ({ authRepository } = await import('../../src/modules/auth/auth.repository.js'));
  ({ photoUploads, businessDate } = await import('../../src/modules/photos/photos.upload.js'));
  ({ reconcilePhotoUploads } = await import('../../src/modules/photos/photos.reconciliation.js'));
  passwordHash = await hashPassword('Test-password-1234');
  await migrate(db, env, { init: true });
  await db.query("INSERT INTO ciudad (nombre) VALUES ('Ciudad')");
  await db.query("INSERT INTO puesto (nombre, direccion, id_ciudad) VALUES ('Uno','A',1),('Dos','B',1),('Sin registros','C',1)");
  for (const [key, role, station] of [['dueno', 'dueno', null], ['encargado', 'encargado', '1'], ['otroEncargado', 'encargado', '2'],
    ['secretario', 'secretario', '1'], ['vendedor', 'vendedor', '1'], ['camarografo', 'camarografo', '1'], ['cliente', 'cliente', null], ['otroCliente', 'cliente', null]]) {
    const [[r]] = await db.execute('SELECT id_rol FROM rol WHERE nombre = ?', [role]);
    const dni = String(10000000 + Object.keys(users).length), email = `${key.toLowerCase()}@example.com`;
    const [result] = await db.execute(`INSERT INTO usuarios (nombre, apellido, email, dni, password, id_rol, id_puesto)
      VALUES (?, ?, ?, ?, ?, ?, ?)`, [key, 'Apellido', email, dni, passwordHash, r.id_rol, station]);
    users[key] = String(result.insertId); tokens[key] = newToken();
    await db.execute('INSERT INTO sesiones_usuario (id_usuario, token, expires_at) VALUES (?, ?, TIMESTAMPADD(HOUR, 2, UTC_TIMESTAMP(6)))', [users[key], tokens[key]]);
  }
  await db.query("INSERT INTO dias (fecha, fotos, descartes, id_puesto) VALUES ('2026-10-14',100,30,1),('2026-10-14',10,0,2)");
  await db.execute("INSERT INTO fotos (id_archivo, id_dia, id_cliente, id_puesto) VALUES ('1/photo.jpg',1,?,1),('1/other.jpg',1,?,1)", [users.cliente, users.otroCliente]);
  await db.query("INSERT INTO precios (nombre, monto, id_puesto) VALUES ('Inicial',20,1),('Otra',25,1)");
  await db.query('INSERT INTO venta (cantidad, precio_total, id_dias) VALUES (50,1000,1),(20,500,1),(10,200,2)');
  await db.query('INSERT INTO precios_venta (id_venta,id_precio,precio_unitario_aplicado,cantidad) VALUES (1,1,20,30),(1,1,20,20),(2,2,25,20),(3,1,20,10)');
  await db.query('INSERT INTO fotos_venta (id_foto,id_venta) VALUES (1,1),(2,1)');
  await db.execute("INSERT INTO horarios (id_dias,id_usuario,check_in,check_out) VALUES (1,?,'2026-10-14 23:00:00','2026-10-15 01:00:00')", [users.vendedor]);
  for (const role of ['secretario', 'vendedor', 'camarografo'])
    await db.execute("INSERT INTO horarios (id_dias,id_usuario,check_in) VALUES (1,?,'2026-10-14 12:00:00')", [users[role]]);
  const { createApp } = await import('../../src/app.js');
  const app = createApp();
  server = app.listen(0, '127.0.0.1'); await new Promise(resolve => server.once('listening', resolve));
  http = axios.create({ baseURL: `http://127.0.0.1:${server.address().port}`, validateStatus: () => true, timeout: 10000, proxy: false });
});
after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
  if (db) await db.end();
  if (admin) { await admin.query(`DROP DATABASE IF EXISTS \`${database}\``); await admin.end(); }
});

integration('API: POST, autenticación, CORS y validación', async () => {
  assert.equal((await http.post('/api/health')).status, 200);
  assert.equal((await http.get('/api/health')).status, 405);
  assert.equal((await http.post('/api/users/query', {})).status, 401);
  assert.equal((await http.post('/api/health', {}, { headers: { Origin: 'https://hostile.example' } })).status, 403);
  assert.equal((await call('reports/query', { ...period, stationId: '1 OR 1=1' })).status, 422);
  assert.equal((await call('reports/query', { ...period, actorId: users.dueno })).status, 422);
});
integration('check-in: puesto, credenciales, bloqueo del encargado y acceso desde otros dispositivos', async () => {
  const [[role]] = await db.query("SELECT id_rol FROM rol WHERE nombre='vendedor'");
  const ids = [];
  for (const [name, station, active] of [['kioskEmployee', '1', true], ['kioskOther', '2', true], ['kioskInactive', '1', false]]) {
    const [result] = await db.execute(`INSERT INTO usuarios (nombre,apellido,email,dni,password,id_rol,id_puesto,disponible)
      VALUES (?,'Prueba',?,?,?,?,?,?)`, [name, `${name.toLowerCase()}@example.com`, String(70000000 + ids.length), passwordHash, role.id_rol, station, active]);
    ids.push(String(result.insertId));
  }
  const employee = ids[0], credentials = { email: 'kioskemployee@example.com', password: 'Test-password-1234' };
  const session = (await call('auth/login', credentials)).data.data.token;
  const device = (path, input = {}) => http.post(`/api/${path}`, input, { headers: { Authorization: `Bearer ${session}` } });
  assert.equal((await device('auth/me')).data.data.working, false);
  assert.equal((await device('auth/me')).data.data.stationName, 'Uno');
  assert.equal((await device('sales/query', period)).data.error.code, 'CHECK_IN_REQUIRED');
  assert.equal((await call('attendance/kiosk/enter')).status, 403);
  assert.equal((await call('attendance/kiosk/employees', {}, 'encargado')).status, 409);
  assert.equal((await call('attendance/kiosk/enter', {}, 'encargado')).status, 200);
  try {
    for (const path of ['users/query', 'auth/logout', 'auth/sessions/revoke', 'auth/password/change'])
      assert.equal((await call(path, {}, 'encargado')).data.error.code, 'KIOSK_LOCKED');
    const roster = (await call('attendance/kiosk/employees', {}, 'encargado')).data.data;
    assert(roster.some(row => row.id === employee && row.working === false));
    assert(!roster.some(row => ids.slice(1).includes(row.id)));
    assert(roster.every(row => row.email === undefined && row.password === undefined));
    const mark = { ...credentials, userId: employee, action: 'check-in', attendanceId: null };
    assert.equal((await call('attendance/kiosk/mark', { ...mark, password: 'incorrecta' }, 'encargado')).status, 401);
    assert.equal((await call('attendance/kiosk/mark', { ...mark, email: 'vendedor@example.com' }, 'encargado')).status, 401);
    assert.equal((await call('attendance/kiosk/mark', { ...mark, userId: ids[1], email: 'kioskother@example.com' }, 'encargado')).status, 401);
    const results = await Promise.all([call('attendance/kiosk/mark', mark, 'encargado'), call('attendance/kiosk/mark', mark, 'encargado')]);
    assert.deepEqual(results.map(row => row.status).sort(), [200, 409]);
    assert.equal((await device('auth/me')).data.data.working, true);
    assert.equal((await device('sales/query', period)).status, 200);
    assert.equal((await call('auth/me', {}, 'encargado')).data.data.id, users.encargado);
    const current = (await call('attendance/kiosk/employees', {}, 'encargado')).data.data.find(row => row.id === employee);
    // Una jornada abierta continúa al cruzar medianoche y conserva el día de entrada al salir.
    await db.execute('UPDATE horarios SET id_dias = 1, check_in = TIMESTAMPADD(HOUR,-26,UTC_TIMESTAMP(6)) WHERE id_horario = ?', [current.attendanceId]);
    assert.equal((await device('auth/me')).data.data.working, true);
    const checkout = { ...mark, action: 'check-out', attendanceId: current.attendanceId };
    assert.equal((await call('attendance/kiosk/mark', checkout, 'encargado')).status, 200);
    assert.equal((await call('attendance/kiosk/mark', checkout, 'encargado')).status, 409);
    assert.equal((await device('auth/me')).data.data.working, false);
    assert.equal((await device('sales/query', period)).status, 403);
    const [[closed]] = await db.execute('SELECT id_dias, check_out FROM horarios WHERE id_horario = ?', [current.attendanceId]);
    assert.equal(closed.id_dias, '1'); assert(closed.check_out);
    assert.equal((await call('attendance/kiosk/exit', { password: 'incorrecta' }, 'encargado')).status, 401);
    assert.equal((await call('auth/me', {}, 'encargado')).data.data.kioskMode, true);
    assert.equal((await call('attendance/kiosk/exit', { password: 'Test-password-1234' }, 'encargado')).status, 200);
    assert.equal((await call('users/query', {}, 'encargado')).status, 200);
  } finally {
    await db.execute('UPDATE sesiones_usuario SET check_in_mode = FALSE WHERE id_usuario = ?', [users.encargado]);
    await db.execute('DELETE FROM horarios WHERE id_usuario = ?', [employee]);
  }
});
integration('puestos: alta, baja reversible, permisos e historial', async () => {
  // Simula una instalación existente con su catálogo de permisos ya poblado.
  await db.query('ALTER TABLE puesto DROP COLUMN disponible');
  await db.query("DELETE pr FROM permisos_rol pr JOIN permisos p ON p.id_permisos=pr.id_permiso WHERE p.tipo_de_permiso='stations.manage'");
  await db.query("DELETE FROM permisos WHERE tipo_de_permiso='stations.manage'");
  await migrate(db, env);
  const [[existing]] = await db.query('SELECT MIN(disponible) AS active FROM puesto');
  assert.equal(Number(existing.active), 1);
  const input = { name: 'Nuevo puesto', address: 'Calle 123', city: 'Ciudad', event: 'Nuevo evento' };
  for (const role of ['encargado', 'secretario', 'vendedor', 'camarografo', 'cliente']) {
    assert.equal((await call('catalog/stations/create', input, role)).status, 403);
    assert.equal((await call('catalog/stations/availability', { stationId: '1', active: false }, role)).status, 403);
  }
  assert.equal((await call('catalog/stations/create', { ...input, name: ' ' })).status, 422);
  const created = await call('catalog/stations/create', input);
  assert.equal(created.status, 200); const id = created.data.data.id;
  assert.equal((await call('catalog/stations/create', input)).status, 409);
  const [[cityCount]] = await db.query("SELECT COUNT(*) AS count FROM ciudad WHERE nombre='Ciudad'");
  assert.equal(Number(cityCount.count), 1);
  assert.equal((await call('catalog/stations/availability', { stationId: id, active: false })).status, 200);
  await migrate(db, env);
  const [[inactive]] = await db.execute('SELECT disponible AS active FROM puesto WHERE id_puesto=?', [id]);
  assert.equal(Number(inactive.active), 0);
  assert.equal((await call('catalog/stations/create', input)).status, 409);
  assert.equal((await call('catalog/stations/availability', { stationId: id, active: true })).status, 200);
  assert.equal((await call('catalog/stations/availability', { stationId: '999999', active: false })).status, 404);
  const [[before]] = await db.query('SELECT COUNT(*) AS count FROM fotos WHERE id_puesto=1');
  assert.equal((await call('catalog/stations/availability', { stationId: '1', active: false })).status, 200);
  const uploads = storageCalls.uploads;
  assert.equal((await upload(randomUUID())).status, 409);
  assert.equal(storageCalls.uploads, uploads);
  const catalog = await call('catalog/query', { resource: 'stations' });
  assert.equal(Number(catalog.data.data.find(row => String(row.id) === '1').active), 0);
  assert.equal((await call('reports/query', period)).status, 200);
  const [[after]] = await db.query('SELECT COUNT(*) AS count FROM fotos WHERE id_puesto=1');
  assert.equal(after.count, before.count);
  const [[sellerRole]] = await db.query("SELECT id_rol AS id FROM rol WHERE nombre='vendedor'");
  assert.equal((await call('users/create', { firstName: 'Nuevo', lastName: 'Empleado', email: 'inactive-station@example.com', dni: '48555999', password: 'Test-password-1234', roleId: String(sellerRole.id), stationId: '1' })).status, 422);
  assert.equal((await call('catalog/stations/availability', { stationId: '1', active: true })).status, 200);
  const operation = randomUUID();
  assert.equal((await upload(operation)).status, 200);
  // Dejar las cantidades iniciales intactas para las comprobaciones de informes.
  const [[photo]] = await db.execute('SELECT id_foto,id_archivo FROM photo_uploads WHERE operation_id=?', [operation]);
  await db.execute('DELETE FROM photo_uploads WHERE operation_id=?', [operation]);
  await db.execute('DELETE FROM fotos WHERE id_fotos=?', [photo.id_foto]);
  objects.delete(photo.id_archivo);
  await db.execute('DELETE FROM dias WHERE fecha=? AND id_puesto=1 AND fecha<>?', [businessDate(new Date()), period.from]);
  await db.execute('DELETE FROM puesto WHERE id_puesto=?', [id]);
});

integration('login real guarda el token de sesión sin hash y rechaza contraseñas erróneas', async () => {
  const response = await call('auth/login', { email: 'dueno@example.com', password: 'Test-password-1234' });
  assert.equal(response.status, 200); const token = response.data.data.token;
  const [[session]] = await db.execute('SELECT token FROM sesiones_usuario WHERE token = ?', [token]);
  assert(session); assert.equal(session.token, token);
  assert.equal((await call('auth/login', { email: 'dueno@example.com', password: 'wrong' })).status, 401);
  assert.equal((await call('auth/login', { email: 'nobody@example.com', password: 'wrong' })).status, 401);
});
integration('permisos frescos, secretario sin escritura y encargado sin acceso a otro puesto', async () => {
  assert.equal((await call('reports/query', period, 'secretario')).status, 200);
  assert.equal((await call('users/availability', { userId: users.vendedor, active: false }, 'secretario')).status, 403);
  assert.equal((await call('reports/query', { ...period, stationId: '2' }, 'encargado')).status, 403);
  assert.equal((await call('users/detail', { userId: users.otroEncargado }, 'encargado')).status, 404);
  await db.query("DELETE pr FROM permisos_rol pr JOIN rol r ON r.id_rol=pr.id_rol JOIN permisos p ON p.id_permisos=pr.id_permiso WHERE r.nombre='secretario' AND p.tipo_de_permiso='reports.read'");
  assert.equal((await call('reports/query', period, 'secretario')).status, 403);
  await db.query("INSERT INTO permisos_rol (id_rol,id_permiso) SELECT r.id_rol,p.id_permisos FROM rol r CROSS JOIN permisos p WHERE r.nombre='secretario' AND p.tipo_de_permiso='reports.read'");
});
integration('cliente aislado por propietario, incluso en acceso directo', async () => {
  const response = await call('photos/query', period, 'cliente');
  assert.equal(response.status, 200); assert.equal(response.data.data.length, 1);
  assert.equal(response.data.data[0].clientId, users.cliente); assert.equal(response.data.data[0].file, undefined);
  assert.equal((await call('photos/access', { photoId: '2' }, 'cliente')).status, 404);
  assert.equal((await call('photos/detail', { photoId: '2' }, 'cliente')).status, 404);
  assert.equal((await call('photos/access', { photoId: '1' }, 'cliente')).status, 200);
  assert.equal((await call('users/query', {}, 'cliente')).status, 403);
  assert.equal((await call('reports/query', period, 'cliente')).status, 403);
  assert.equal((await call('photos/query', period, 'dueno')).status, 403);
});

integration('encargado consulta y gestiona únicamente usuarios, horarios y datos de su puesto', async () => {
  for (const path of ['users/query', 'attendance/query', 'reports/query', 'reports/days/query', 'sales/query', 'photos/query']) {
    const filters = path === 'users/query' ? {} : period;
    const response = await call(path, filters, 'encargado');
    assert.equal(response.status, 200, path);
    assert(response.data.data.every(row => row.stationId === '1'), path);
    assert.equal((await call(path, { ...filters, stationId: '2' }, 'encargado')).status, 403, path);
  }
  assert.equal((await call('users/availability', { userId: users.otroEncargado, active: false }, 'encargado')).status, 404);
  assert.equal((await call('sales/detail', { saleId: '3' }, 'encargado')).status, 404);
  assert.equal((await call('reports/summary', { ...period, stationId: '2' }, 'encargado')).status, 403);
  assert.equal((await call('catalog/query', { resource: 'stations' }, 'encargado')).data.data.length, 1);
  await db.execute("INSERT INTO horarios (id_dias,id_usuario,check_in,check_out) VALUES (1,?,'2026-10-14 10:00:00','2026-10-14 11:00:00'),(2,?,'2026-10-14 10:00:00','2026-10-14 11:00:00')", [users.encargado, users.encargado]);
  try {
    const mine = await call('attendance/mine', period, 'encargado');
    assert.equal(mine.status, 200); assert.equal(mine.data.data.length, 1);
    assert.equal(mine.data.data[0].stationId, '1');
  } finally { await db.execute('DELETE FROM horarios WHERE id_usuario=?', [users.encargado]); }
});
integration('informes: 100 tomadas, 70 vendidas y 30 descartes sin multiplicar importes', async () => {
  const response = await call('reports/query', period); assert.equal(response.status, 200);
  const [first, second, empty] = response.data.data;
  assert.equal(Number(first.taken), 100); assert.equal(Number(first.sold), 70);
  assert.equal(Number(first.discarded), 30); assert.equal(Number(first.revenue), 1500); assert.equal(Number(first.percentage), 70);
  assert.equal(Number(second.discarded), 0); assert.equal(empty.taken, null); assert.equal(Number(empty.sold), 0);
  const partial = await call('reports/query', { from: '2026-10-14', to: '2026-10-15' });
  assert.equal(partial.data.data[0].taken, null); assert.equal(partial.data.data[0].discarded, null);
  const daily = await call('reports/days/query', period, 'vendedor');
  assert.equal(daily.data.data.length, 1); assert.equal(Number(daily.data.data[0].discarded), 30);
  const summary = await call('reports/summary', { ...period, limit: 1 });
  assert.equal(summary.status, 200); assert.equal(Number(summary.data.data.sold), 80);
  assert.equal(Number(summary.data.data.revenue), 1700); assert.equal(summary.data.data.taken, null);
  const scoped = await call('reports/summary', period, 'encargado');
  assert.equal(Number(scoped.data.data.percentage), 70);
});
integration('porcentaje global ponderado e inconsistencias que no se compensan entre días', async () => {
  await db.query("INSERT INTO dias (fecha,fotos,descartes,id_puesto) VALUES ('2026-10-14',0,0,3)");
  const summary = await call('reports/summary', period);
  assert.equal(Number(summary.data.data.taken), 110); assert.equal(Number(summary.data.data.percentage), 72.73);
  await db.query("INSERT INTO dias (fecha,fotos,descartes,id_puesto) VALUES ('2026-10-15',1,0,1)");
  await db.query("INSERT INTO venta (cantidad,precio_total,id_dias) SELECT 2,10,id_dias FROM dias WHERE id_puesto=1 AND fecha='2026-10-15'");
  const invalid = await call('reports/query', { from: '2026-10-14', to: '2026-10-15', stationId: '1' });
  assert.equal(Number(invalid.data.data[0].invalidDays), 1); assert.equal(invalid.data.data[0].discarded, null);
  await db.query("DELETE v FROM venta v JOIN dias d ON d.id_dias=v.id_dias WHERE d.fecha='2026-10-15'");
  await db.query("DELETE FROM dias WHERE fecha='2026-10-15' OR id_puesto=3");
});
integration('ventas conserva tarifas históricas y separa las tablas intermedias', async () => {
  await db.query('UPDATE precios SET monto=999 WHERE id_precios=1');
  const response = await call('sales/detail', { saleId: '1' }, 'vendedor');
  assert.equal(response.status, 200); assert.equal(Number(response.data.data.total), 1000);
  assert.equal(response.data.data.prices.length, 2); assert.equal(response.data.data.photos.length, 2);
  assert.equal(Number(response.data.data.prices[0].unitPrice), 20);
  assert.equal((await call('sales/detail', { saleId: '3' }, 'vendedor')).status, 404);
});
integration('asistencia conserva puesto histórico y turno que cruza medianoche', async () => {
  await db.execute('UPDATE usuarios SET id_puesto=2 WHERE id_usuario=?', [users.vendedor]);
  try {
    const response = await call('attendance/query', { ...period, userId: users.vendedor }, 'encargado');
    assert.equal(response.status, 200); assert.equal(response.data.data.length, 2);
    const closed = response.data.data.find(row => row.checkOut !== null);
    assert.equal(closed.stationId, '1'); assert.equal(Number(closed.durationSeconds), 7200);
    assert.equal((await call('attendance/query', period, 'otroEncargado')).data.data.length, 0);
  } finally { await db.execute('UPDATE usuarios SET id_puesto=1 WHERE id_usuario=?', [users.vendedor]); }
});
integration('alta guarda datos sin cifrar, hashea contraseña y rechaza duplicados y escalamiento', async () => {
  const [[role]] = await db.query("SELECT id_rol FROM rol WHERE nombre='cliente'");
  const input = { firstName: 'Cliente nuevo', lastName: 'Prueba', email: 'new@example.com', dni: '30444555', password: 'New-password-1234', roleId: String(role.id_rol), stationId: null };
  const response = await call('users/create', input); assert.equal(response.status, 200);
  const [[stored]] = await db.execute('SELECT nombre,email,dni,password FROM usuarios WHERE id_usuario=?', [response.data.data.id]);
  assert.equal(stored.nombre, input.firstName); assert.equal(stored.email, input.email); assert.equal(stored.dni, input.dni); assert(stored.password.startsWith('scrypt$'));
  assert.equal((await call('users/query', { email: input.email })).data.data.length, 1);
  assert.equal((await call('users/create', input)).status, 409);
  assert.equal((await call('users/create', { ...input, email: 'other@example.com', dni: '30444556' }, 'encargado')).status, 403);
});
integration('baja reversible invalida sesiones anteriores y preserva el identificador', async () => {
  assert.equal((await call('users/availability', { userId: users.vendedor, active: false }, 'encargado')).status, 200);
  assert.equal((await call('auth/me', {}, 'vendedor')).status, 401);
  assert.equal((await call('users/availability', { userId: users.vendedor, active: true }, 'encargado')).status, 200);
  assert.equal((await call('auth/me', {}, 'vendedor')).status, 401);
  const detail = await call('users/detail', { userId: users.vendedor });
  assert.equal(detail.data.data.id, users.vendedor); assert.equal(detail.data.data.active, true);
});
integration('operaciones inválidas y marcación fuera de la vista no escriben registros', async () => {
  const [[before]] = await db.query('SELECT COUNT(*) AS count FROM venta');
  assert.equal((await call('sales/create', {}, 'encargado')).status, 422);
  assert.equal((await call('attendance/check-in', {}, 'encargado')).status, 403);
  assert.equal((await call('photos/upload', {}, 'cliente')).status, 403);
  const [[after]] = await db.query('SELECT COUNT(*) AS count FROM venta'); assert.equal(after.count, before.count);
});
integration('carga opcional, reintentos concurrentes y asignación posterior no duplican conteos', async () => {
  const date = businessDate(new Date()), operation = randomUUID();
  const [[before]] = await db.execute('SELECT COALESCE(SUM(fotos),0) AS taken FROM dias WHERE fecha=? AND id_puesto=1', [date]);
  const initialCalls = storageCalls.uploads;
  const [first, retry] = await Promise.all([upload(operation), upload(operation)]);
  assert.equal(first.status, 200); assert.equal(retry.status, 200);
  const photo = first.data.data; assert.equal(photo.clientId, null); assert.equal(photo.date, date);
  assert.equal(retry.data.data.id, photo.id); assert.equal(storageCalls.uploads - initialCalls, 1);
  const query = { from: date, to: date, unassigned: true };
  assert((await call('photos/query', query, 'encargado')).data.data.some(row => row.id === photo.id));
  assert.equal((await call('photos/query', query, 'cliente')).status, 403);
  assert.equal((await call('photos/detail', { photoId: photo.id }, 'cliente')).status, 404);
  assert.equal((await call('photos/access', { photoId: photo.id }, 'cliente')).status, 404);
  const assigned = await call('photos/assign', { photoId: photo.id, clientEmail: 'cliente@example.com' }, 'encargado');
  assert.equal(assigned.status, 200); assert.equal(assigned.data.data.clientId, users.cliente);
  assert.equal((await call('photos/assign', { photoId: photo.id, clientEmail: 'cliente@example.com' }, 'encargado')).status, 200);
  assert.equal((await call('photos/assign', { photoId: photo.id, clientEmail: 'otroCliente@example.com' }, 'encargado')).status, 409);
  assert.equal((await call('photos/access', { photoId: photo.id }, 'cliente')).status, 200);
  assert.equal((await call('photos/access', { photoId: photo.id }, 'otroCliente')).status, 404);
  const replay = await upload(operation); assert.equal(replay.data.data.clientId, users.cliente);
  assert.equal((await upload(operation, users.cliente)).status, 409);
  const [[after]] = await db.execute('SELECT fotos,descartes FROM dias WHERE fecha=? AND id_puesto=1', [date]);
  assert.equal(after.fotos, Number(before.taken) + 1); assert.equal(after.descartes, after.fotos);
});
integration('cliente durante carga y asignaciones concurrentes respetan permisos y puesto', async () => {
  const initial = await upload(randomUUID(), users.otroCliente); assert.equal(initial.status, 200);
  assert.equal(initial.data.data.clientId, users.otroCliente);
  assert.equal((await call('photos/access', { photoId: initial.data.data.id }, 'otroCliente')).status, 200);
  const unassigned = await upload(randomUUID()); assert.equal(unassigned.status, 200);
  const photoId = unassigned.data.data.id;
  assert.equal((await call('photos/assign', { photoId, clientEmail: 'cliente@example.com' }, 'otroEncargado')).status, 403);
  assert.equal((await call('photos/assign', { photoId, clientEmail: 'cliente@example.com' }, 'cliente')).status, 403);
  assert.equal((await call('photos/assign', { photoId, clientEmail: 'vendedor@example.com' }, 'encargado')).status, 422);
  const assignments = await Promise.all([
    call('photos/assign', { photoId, clientEmail: 'cliente@example.com' }, 'encargado'),
    call('photos/assign', { photoId, clientEmail: 'otroCliente@example.com' }, 'camarografo'),
  ]);
  assert.deepEqual(assignments.map(r => r.status).sort(), [200, 409]);
});
integration('carga valida cliente, puesto, formato real y límite de 6 MB antes de guardar', async () => {
  const before = storageCalls.uploads;
  assert.equal((await upload(randomUUID(), users.vendedor)).status, 422);
  assert.equal((await upload(randomUUID(), '999999999')).status, 422);
  assert.equal((await upload(randomUUID(), undefined, { stationId: '2' })).status, 403);
  assert.equal((await upload(randomUUID(), undefined, { role: 'cliente' })).status, 403);
  assert.equal((await upload(randomUUID(), undefined, { bytes: Buffer.from('<svg></svg>') })).status, 422);
  assert.equal((await upload(randomUUID(), undefined, { bytes: Buffer.alloc(6 * 1024 * 1024 + 1) })).status, 413);
  await db.query("DELETE pr FROM permisos_rol pr JOIN rol r ON r.id_rol=pr.id_rol JOIN permisos p ON p.id_permisos=pr.id_permiso WHERE r.nombre='encargado' AND p.tipo_de_permiso='photos.assign'");
  try { assert.equal((await upload(randomUUID(), users.cliente)).status, 403); }
  finally { await db.query("INSERT INTO permisos_rol (id_rol,id_permiso) SELECT r.id_rol,p.id_permisos FROM rol r CROSS JOIN permisos p WHERE r.nombre='encargado' AND p.tipo_de_permiso='photos.assign'"); }
  assert.equal(storageCalls.uploads, before);
});
integration('fallo parcial de Storage no suma fotos y la reconciliación preserva las confirmadas', async () => {
  const operation = randomUUID(), date = businessDate(new Date());
  const [[before]] = await db.execute('SELECT fotos FROM dias WHERE fecha=? AND id_puesto=1', [date]);
  try { failureMode = 'after'; assert.equal((await upload(operation)).status, 502); }
  finally { failureMode = null; }
  const [[job]] = await db.execute('SELECT id_archivo,id_foto FROM photo_uploads WHERE operation_id=?', [operation]);
  assert.equal(job.id_foto, null); assert(objects.has(job.id_archivo));
  const [[after]] = await db.execute('SELECT fotos FROM dias WHERE fecha=? AND id_puesto=1', [date]); assert.equal(after.fotos, before.fotos);
  await db.execute('UPDATE photo_uploads SET last_attempt_at=TIMESTAMPADD(MINUTE,-6,UTC_TIMESTAMP(6)) WHERE id_foto IS NULL');
  const confirmed = [...objects.keys()].filter(key => key !== job.id_archivo);
  const result = await reconcilePhotoUploads();
  assert(result.cleaned > 0); assert.equal(objects.has(job.id_archivo), false);
  assert(confirmed.every(key => objects.has(key)));
  const retried = await upload(operation); assert.equal(retried.status, 200); assert(objects.has(job.id_archivo));
});
integration('fallos al guardar metadatos o recibir COMMIT se recuperan sin doble conteo', async () => {
  const actor = await authRepository.actor(tokens.encargado);
  const date = businessDate(new Date());
  for (const fault of ['metadata', 'commit']) {
    const input = { operationId: randomUUID(), stationId: '1', clientId: null };
    const [[before]] = await db.execute('SELECT fotos FROM dias WHERE fecha=? AND id_puesto=1', [date]);
    const getConnection = db.getConnection.bind(db);
    const faulty = { execute: (...args) => db.execute(...args), async getConnection() {
      const connection = await getConnection();
      return new Proxy(connection, { get(target, property) {
        if (property === 'execute' && fault === 'metadata') return async (sql, values) => {
          if (sql.startsWith('INSERT INTO fotos')) throw new Error('metadata failure');
          return target.execute(sql, values);
        };
        if (property === 'commit' && fault === 'commit') return async () => { await target.commit(); throw new Error('commit response lost'); };
        const value = target[property]; return typeof value === 'function' ? value.bind(target) : value;
      } });
    } };
    const replacement = mock.method(db, 'getConnection', () => faulty.getConnection());
    try { await assert.rejects(photoUploads.upload(actor, input, { buffer: png })); }
    finally { replacement.mock.restore(); }
    const [[middle]] = await db.execute('SELECT fotos FROM dias WHERE fecha=? AND id_puesto=1', [date]);
    assert.equal(middle.fotos, before.fotos + (fault === 'commit' ? 1 : 0));
    assert.equal((await upload(input.operationId)).status, 200);
    const [[after]] = await db.execute('SELECT fotos FROM dias WHERE fecha=? AND id_puesto=1', [date]); assert.equal(after.fotos, before.fotos + 1);
  }
});
integration('migración de ventas y precios anteriores conserva el historial sin asignar tarifas globales', async () => {
  await db.query('ALTER TABLE precios DROP FOREIGN KEY fk_precios_puesto');
  await db.query('ALTER TABLE precios DROP COLUMN id_puesto, DROP COLUMN disponible');
  await db.query('ALTER TABLE venta DROP INDEX uq_venta_operation');
  for (const name of ['operation_id', 'request_data', 'id_vendedor', 'metodo_pago', 'copias', 'familia_contada', 'created_at'])
    await db.query(`ALTER TABLE venta DROP COLUMN ${name}`);
  await migrate(db, env);
  await migrate(db, env);
  const [[legacy]] = await db.query('SELECT COUNT(*) AS n FROM precios WHERE id_puesto IS NULL');
  assert.equal(Number(legacy.n), 2);
  assert.deepEqual((await call('catalog/query', { resource: 'prices', stationId: '1' }, 'encargado')).data.data, []);
  const detail = (await call('sales/detail', { saleId: '1' }, 'encargado')).data.data;
  assert.equal(detail.total, '1000.00'); assert.equal(detail.prices.length, 2);
});

integration('ventas del evento: tarifas por puesto, copias, familias, reintentos y cierre', async () => {
  tokens.vendedor = (await call('auth/login', { email: 'vendedor@example.com', password: 'Test-password-1234' })).data.data.token;
  const form = { operationId: randomUUID(), stationId: '1', photoId: '1', paymentMethod: 'efectivo', prices: [{ priceId: '1', copies: 3 }] };
  assert.equal((await call('sales/create', form, 'vendedor')).data.error.code, 'EVENT_CLOSED');
  assert.equal((await call('sales/event/set', { stationId: '1', open: true }, 'vendedor')).status, 403);
  assert.equal((await call('sales/event/set', { stationId: '2', open: true }, 'encargado')).status, 403);
  const opened = await call('sales/event/set', { stationId: '1', open: true }, 'encargado');
  assert.equal(opened.status, 200);
  const date = opened.data.data.date;
  // Fotos creadas por este test, fuera de los datos históricos de informes.
  const firstPhoto = (await upload(randomUUID())).data.data.id;
  const secondPhoto = (await upload(randomUUID())).data.data.id;
  form.photoId = firstPhoto;
  await db.query('UPDATE precios SET disponible=0 WHERE id_puesto=1');
  assert.equal((await call('sales/create', form, 'vendedor')).data.error.code, 'NO_PRICES');
  const empty = await call('catalog/query', { resource: 'prices', stationId: '1' }, 'vendedor');
  assert.deepEqual(empty.data.data, []);
  const created = await call('catalog/prices/create', { stationId: '1', name: 'Copia', amount: '10.10' });
  const another = await call('catalog/prices/create', { stationId: '1', name: 'Grande', amount: '20.25' });
  const otherStation = await call('catalog/prices/create', { stationId: '2', name: 'Ajena', amount: '1.00' });
  assert.equal(created.status, 200);
  assert.equal((await call('catalog/prices/create', { stationId: '1', name: 'Prohibida', amount: '1' }, 'vendedor')).status, 403);
  form.prices = [{ priceId: otherStation.data.data.id, copies: 1 }];
  assert.equal((await call('sales/create', form, 'vendedor')).data.error.code, 'INVALID_PRICE');
  form.prices = [{ priceId: created.data.data.id, copies: 3 }, { priceId: another.data.data.id, copies: 2 }];
  const [[before]] = await db.execute('SELECT COUNT(*) AS n FROM venta');
  const responses = await Promise.all([call('sales/create', form, 'vendedor'), call('sales/create', form, 'vendedor')]);
  assert(responses.every(response => response.status === 200), JSON.stringify(responses.map(response => response.data)));
  assert.equal(responses[0].data.data.id, responses[1].data.data.id);
  const [[after]] = await db.execute('SELECT COUNT(*) AS n FROM venta');
  assert.equal(Number(after.n), Number(before.n) + 1);
  const detail = (await call('sales/detail', { saleId: responses[0].data.data.id }, 'vendedor')).data.data;
  assert.equal(detail.total, '70.80'); assert.equal(Number(detail.copies), 5); assert.equal(detail.prices.length, 2);
  assert.equal(detail.paymentMethod, 'efectivo');
  assert.equal((await call('sales/create', { ...form, paymentMethod: 'tarjeta' }, 'vendedor')).status, 409);
  const extra = await call('sales/create', { ...form, operationId: randomUUID(), paymentMethod: 'transferencia' }, 'vendedor');
  assert.equal(extra.status, 200); assert.equal(extra.data.data.counted, false);
  const independent = await Promise.all(['vendedor', 'encargado'].map(role => call('sales/create', {
    ...form, photoId: secondPhoto, operationId: randomUUID(), paymentMethod: 'tarjeta',
  }, role)));
  assert(independent.every(response => response.status === 200));
  assert.equal(independent.filter(response => response.data.data.counted).length, 1);
  const days = (await call('reports/days/query', { from: date, to: date, stationId: '1' }, 'vendedor')).data.data;
  assert.equal(Number(days[0].sold), 2);
  assert.equal(days[0].revenue, '283.20');
  const photos = await call('sales/photos', { stationId: '1' }, 'vendedor');
  assert.equal(photos.status, 200); assert(photos.data.data.some(photo => photo.id === firstPhoto && photo.sold));
  assert.equal((await call('sales/photos/access', { photoId: firstPhoto }, 'vendedor')).status, 200);
  assert.equal((await call('sales/photos/access', { photoId: firstPhoto }, 'cliente')).status, 403);
  assert.equal((await call('sales/create', { ...form, operationId: randomUUID(), photoId: '1' }, 'vendedor')).status, 422);
  assert.equal((await call('sales/event/set', { stationId: '1', open: false }, 'encargado')).status, 200);
  assert.equal((await call('sales/create', { ...form, operationId: randomUUID() }, 'vendedor')).data.error.code, 'EVENT_CLOSED');
  // Una confirmación perdida puede recuperarse incluso después del cierre.
  assert.equal((await call('sales/create', form, 'vendedor')).status, 200);
  assert.deepEqual((await call('sales/photos', { stationId: '1' }, 'vendedor')).data.data, []);
});

integration('encargado administra precios de su puesto y conserva tarifas históricas', async () => {
  // Simula una instalación que todavía no tenía el permiso.
  await db.query("DELETE pr FROM permisos_rol pr JOIN permisos p ON p.id_permisos=pr.id_permiso WHERE p.tipo_de_permiso='prices.manage'");
  await db.query("DELETE FROM permisos WHERE tipo_de_permiso='prices.manage'");
  await migrate(db, env);
  assert((await call('auth/me', {}, 'encargado')).data.data.permissions.includes('prices.manage'));
  const input = { stationId: '1', name: 'Tarifa del encargado', amount: '12.50' };
  const created = await call('catalog/prices/create', input, 'encargado');
  assert.equal(created.status, 200); const priceId = created.data.data.id;
  assert.equal((await call('catalog/prices/create', { ...input, stationId: '2' }, 'encargado')).status, 403);
  for (const role of ['vendedor', 'secretario', 'camarografo', 'cliente'])
    assert.equal((await call('catalog/prices/query', { stationId: '1' }, role)).status, 403);
  const [[foreign]] = await db.query('SELECT id_precios AS id FROM precios WHERE id_puesto=2 LIMIT 1');
  assert.equal((await call('catalog/prices/query', { stationId: '2' }, 'encargado')).status, 403);
  assert.equal((await call('catalog/prices/update', { ...input, priceId: foreign.id }, 'encargado')).status, 404);
  assert.equal((await call('catalog/prices/availability', { stationId: '1', priceId: foreign.id, active: false }, 'encargado')).status, 404);
  assert.equal((await call('catalog/prices/update', { ...input, priceId, amount: '15.75' }, 'encargado')).status, 200);
  assert.equal((await call('catalog/prices/availability', { stationId: '1', priceId, active: false }, 'encargado')).status, 200);
  const all = (await call('catalog/prices/query', { stationId: '1' }, 'encargado')).data.data;
  assert(all.every(row => row.stationId === '1'));
  assert.equal(Number(all.find(row => row.id === priceId).active), 0);
  assert(!(await call('catalog/query', { resource: 'prices' }, 'vendedor')).data.data.some(row => row.id === priceId));
  assert.equal((await call('catalog/prices/availability', { stationId: '1', priceId, active: true }, 'encargado')).status, 200);
  assert.equal((await call('catalog/stations/create', { name: 'No', address: 'No', city: 'No' }, 'encargado')).status, 403);
  const [[historic]] = await db.query(`SELECT pv.id_venta AS saleId, pv.id_precio AS priceId, pv.precio_unitario_aplicado AS amount
    FROM precios_venta pv JOIN venta v ON v.id_venta=pv.id_venta WHERE v.operation_id IS NOT NULL LIMIT 1`);
  await call('catalog/prices/update', { ...input, priceId: historic.priceId, amount: '99.99' }, 'encargado');
  const detail = (await call('sales/detail', { saleId: historic.saleId }, 'encargado')).data.data;
  assert(detail.prices.some(row => row.priceId === historic.priceId && row.unitPrice === historic.amount));
  await db.query("DELETE pr FROM permisos_rol pr JOIN rol r ON r.id_rol=pr.id_rol JOIN permisos p ON p.id_permisos=pr.id_permiso WHERE r.nombre='encargado' AND p.tipo_de_permiso='prices.manage'");
  await migrate(db, env);
  assert.equal((await call('catalog/prices/create', input, 'encargado')).status, 403);
  await db.query("INSERT INTO permisos_rol (id_rol,id_permiso) SELECT r.id_rol,p.id_permisos FROM rol r CROSS JOIN permisos p WHERE r.nombre='encargado' AND p.tipo_de_permiso='prices.manage'");
});

integration('ventas solo lista, previsualiza y vende fotos del día actual de Argentina', async () => {
  // Un evento que quedó abierto ayer ya no habilita fotos ni ventas.
  await db.query('UPDATE event_sales SET id_dia=1, abierta=1 WHERE id_puesto=1');
  assert.equal((await call('sales/event', { stationId: '1' }, 'vendedor')).data.data.open, false);
  assert.deepEqual((await call('sales/photos', { stationId: '1' }, 'vendedor')).data.data, []);
  assert.equal((await call('sales/photos/access', { photoId: '1' }, 'vendedor')).status, 404);
  const [[price]] = await db.query('SELECT id_precios AS id FROM precios WHERE id_puesto=1 AND disponible=1 LIMIT 1');
  const input = { stationId: '1', photoId: '1', operationId: randomUUID(), paymentMethod: 'efectivo', prices: [{ priceId: price.id, copies: 1 }] };
  assert.equal((await call('sales/create', input, 'vendedor')).data.error.code, 'EVENT_CLOSED');
  const open = await call('sales/event/set', { stationId: '1', open: true }, 'encargado');
  assert.equal(open.status, 200); assert.equal(open.data.data.date, businessDate(new Date()));
  const rows = (await call('sales/photos', { stationId: '1' }, 'vendedor')).data.data;
  assert(rows.length > 0); assert(rows.every(row => row.date === businessDate(new Date())));
  assert(!rows.some(row => row.id === '1'));
  assert.equal((await call('sales/photos/access', { photoId: '1' }, 'vendedor')).status, 404);
  assert.equal((await call('sales/create', input, 'vendedor')).status, 422);
  await call('sales/event/set', { stationId: '1', open: false }, 'encargado');
});

integration('cambio de contraseña revoca sesiones y logout no altera asistencia', async () => {
  const [[before]] = await db.query('SELECT COUNT(*) AS count FROM horarios');
  const changed = await call('auth/password/change', { currentPassword: 'Test-password-1234', password: 'Changed-password-1234' }, 'camarografo');
  assert.equal(changed.status, 200); assert.equal((await call('auth/me', {}, 'camarografo')).status, 401);
  assert.equal((await call('auth/logout', {}, 'cliente')).status, 200); assert.equal((await call('auth/me', {}, 'cliente')).status, 401);
  const [[after]] = await db.query('SELECT COUNT(*) AS count FROM horarios'); assert.equal(after.count, before.count);
});
integration('migraciones repetibles preservan permisos y datos originales', async () => {
  await db.query('ALTER TABLE sesiones_usuario DROP COLUMN check_in_mode');
  await db.query('ALTER TABLE horarios DROP INDEX ix_horarios_usuario_abierto');
  await migrate(db, env);
  const response = await call('auth/me'); assert.equal(response.status, 200); assert.equal(response.data.data.email, 'dueno@example.com');
  assert.equal(response.data.data.kioskMode, false);
  const [indexes] = await db.query("SHOW INDEX FROM horarios WHERE Key_name='ix_horarios_usuario_abierto'");
  assert(indexes.length > 0);
});
integration('migración conserva datos personales y sólo hashea contraseñas', async () => {
  const [[role]] = await db.query("SELECT id_rol FROM rol WHERE nombre='cliente'");
  const [created] = await db.execute(`INSERT INTO usuarios (nombre,apellido,email,dni,password,id_rol)
    VALUES ('Anterior','Prueba','Legacy@example.com','40.123.456','Legacy-password-123',?)`, [role.id_rol]);
  await migrate(db, env);
  const [[user]] = await db.execute('SELECT * FROM usuarios WHERE id_usuario=?', [created.insertId]);
  assert.equal(user.email, 'legacy@example.com');
  assert.equal(user.dni, '40123456');
  assert.equal(await verifyPassword('Legacy-password-123', user.password), true);
  await migrate(db, env);
  assert.equal((await call('auth/me')).status, 200);
});
integration('sesiones vencidas y revocación de sesiones ajenas', async () => {
  const token = newToken();
  const [expired] = await db.execute(`INSERT INTO sesiones_usuario (id_usuario,token,created_at,expires_at)
    VALUES (?,?,TIMESTAMPADD(HOUR,-2,UTC_TIMESTAMP(6)),TIMESTAMPADD(HOUR,-1,UTC_TIMESTAMP(6)))`, [users.dueno, token]);
  assert.equal((await http.post('/api/auth/me', {}, { headers: { Authorization: `Bearer ${token}` } })).status, 401);
  await call('auth/sessions/revoke', { sessionId: String(expired.insertId) }, 'secretario');
  const [[row]] = await db.execute('SELECT revoked_at FROM sesiones_usuario WHERE id_sesiones_usuario=?', [expired.insertId]);
  assert.equal(row.revoked_at, null);
});

integration('registro local exige código, permite reenvío y revoca acceso tras la baja lógica del cliente', async () => {
  const input = { firstName: 'Cliente nuevo', lastName: 'Apellido', email: 'nuevo@example.com', dni: '87654321', password: 'Password-test-1234' };
  assert.equal((await call('auth/register', { ...input, roleId: '1' }, 'anon')).status, 422);
  const registration = await call('auth/register', input, 'anon');
  assert.equal(registration.status, 200);
  let verificationToken = registration.data.data.verificationToken;
  assert(verificationToken);
  assert.equal((await call('auth/login', { email: input.email, password: input.password }, 'anon')).data.error.code, 'EMAIL_UNVERIFIED');
  assert.equal((await call('auth/verification/resend', { verificationToken }, 'anon')).status, 429);
  await db.execute('UPDATE client_verifications SET sent_at = TIMESTAMPADD(MINUTE,-2,UTC_TIMESTAMP(6))');
  const resend = await call('auth/verification/resend', { verificationToken }, 'anon');
  assert.equal(resend.status, 200);
  const oldToken = verificationToken;
  verificationToken = resend.data.data.verificationToken;
  assert.notEqual(oldToken, verificationToken);
  assert.equal((await call('auth/verification/confirm', { verificationToken: oldToken, code: verificationMail.at(-1).code }, 'anon')).status, 422);
  assert.equal((await call('auth/verification/confirm', { verificationToken, code: 'bad' }, 'anon')).status, 422);
  const verified = await call('auth/verification/confirm', { verificationToken, code: verificationMail.at(-1).code }, 'anon');
  assert.equal(verified.status, 200);
  tokens.newClient = verified.data.data.token;
  assert.equal((await call('auth/me', {}, 'newClient')).status, 200);
  assert.equal((await call('auth/verification/confirm', { verificationToken, code: verificationMail.at(-1).code }, 'anon')).status, 422);
  const listed = await call('clients/query', { search: 'nuevo@example.com' });
  assert.equal(listed.data.data.clients.length, 1);
  const clientId = String(listed.data.data.clients[0].id);
  for (const role of ['newClient', 'encargado', 'secretario']) {
    if (role !== 'newClient') {
      tokens[role] = newToken();
      await db.execute('INSERT INTO sesiones_usuario (id_usuario,token,expires_at) VALUES (?,?,TIMESTAMPADD(HOUR,1,UTC_TIMESTAMP(6)))', [users[role], tokens[role]]);
    }
    assert.equal((await call('clients/query', {}, role)).status, 403);
    assert.equal((await call('clients/deactivate', { clientId }, role)).status, 403);
  }
  assert.equal((await call('clients/deactivate', { clientId: users.dueno })).status, 404);
  assert.equal((await call('clients/deactivate', { clientId })).status, 200);
  assert.equal((await call('auth/me', {}, 'newClient')).status, 401);
  assert.equal((await call('auth/login', { email: input.email, password: input.password }, 'anon')).status, 401);
  assert.equal((await call('clients/query', { search: input.email })).data.data.clients.length, 0);
  const [[persisted]] = await db.execute('SELECT disponible FROM usuarios WHERE id_usuario = ?', [clientId]);
  assert.equal(persisted.disponible, 0);
});

integration('clientes se consultan de a veinte, con búsqueda parcial por correo o DNI y sin empleados', async () => {
  for (let index = 0; index < 21; index++) await db.execute(`INSERT INTO usuarios (nombre, apellido, email, dni, password, id_rol)
    SELECT 'Cliente', 'Página', ?, ?, ?, id_rol FROM rol WHERE nombre = 'cliente'`, [`pagina-${index}@example.com`, String(90000000 + index), passwordHash]);
  const first = (await call('clients/query', { search: 'pagina-' })).data.data;
  assert.equal(first.clients.length, 20); assert.equal(first.hasMore, true);
  const second = (await call('clients/query', { search: 'pagina-', offset: 20 })).data.data;
  assert.equal(second.clients.length, 1); assert.equal(second.hasMore, false);
  assert(!first.clients.some(row => row.id === second.clients[0].id));
  assert.equal((await call('clients/query', { search: '90.000.020' })).data.data.clients.length, 1);
  assert.equal((await call('clients/query', { search: '%' })).data.data.clients.length, 0);
  assert.equal((await call('clients/query', { search: '-' })).data.data.clients.length, 20);
  assert.equal((await call('clients/query', { limit: 100 })).status, 422);
  assert.equal((await call('clients/query', { search: 'dueno@example.com' })).data.data.clients.length, 0);
});

integration('registro social completa datos y código, conserva identidad y no vincula cuentas por correo', async () => {
  assert.equal((await call('auth/social', { idToken: 'owner' }, 'anon')).data.error.code, 'ACCOUNT_EXISTS');
  assert.equal((await call('auth/social', { idToken: 'social-test' }, 'anon')).data.data.registrationRequired, true);
  const result = await call('auth/social', { idToken: 'social-test', firstName: 'Social', lastName: 'Cliente', dni: '88888888' }, 'anon');
  assert.equal(result.status, 200);
  const { verificationToken } = result.data.data;
  assert.equal((await call('auth/verification/confirm', { verificationToken, code: verificationMail.at(-1).code }, 'anon')).status, 200);
  const login = await call('auth/social', { idToken: 'social-test' }, 'anon');
  assert.equal(login.status, 200);
  tokens.socialClient = login.data.data.token;
  const profile = await call('auth/me', {}, 'socialClient');
  assert.equal(profile.data.data.role, 'cliente');
  const clientId = String(profile.data.data.id);
  await call('clients/deactivate', { clientId });
  assert.equal((await call('auth/social', { idToken: 'social-test' }, 'anon')).status, 403);
  assert.equal((await call('auth/me', {}, 'socialClient')).status, 401);
});

integration('fallo al enviar correo revierte el registro y permite reintentar', async () => {
  const input = { firstName: 'Correo', lastName: 'Fallido', email: 'fallo@example.com', dni: '77777777', password: 'Password-test-1234' };
  mailFailure = true;
  try { assert.equal((await call('auth/register', input, 'anon')).status, 502); }
  finally { mailFailure = false; }
  const [[row]] = await db.execute('SELECT COUNT(*) AS count FROM usuarios WHERE email = ?', [input.email]);
  assert.equal(Number(row.count), 0);
  assert.equal((await call('auth/register', input, 'anon')).status, 200);
});

integration('convierte el esquema anterior, descifra datos y elimina tablas auxiliares sin recrearlas', async () => {
  const key = randomBytes(32), iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
  cipher.setAAD(Buffer.from('nombre'));
  const ciphertext = Buffer.concat([cipher.update('Nombre anterior', 'utf8'), cipher.final()]);
  const encrypted = `enc:v1:${Buffer.concat([iv, cipher.getAuthTag(), ciphertext]).toString('base64')}`;
  await db.query('ALTER TABLE usuarios MODIFY nombre VARCHAR(1024) NOT NULL, ADD email_hash CHAR(64) UNIQUE, ADD dni_hash CHAR(64) UNIQUE');
  await db.execute('UPDATE usuarios SET nombre=? WHERE id_usuario=?', [encrypted, users.dueno]);
  for (const table of ['sesiones_usuario', 'tokens_autenticacion'])
    await db.query(`ALTER TABLE ${table} CHANGE token token_hash VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL`);
  await db.query('ALTER TABLE photo_uploads DROP COLUMN request_data, ADD request_hash CHAR(64), ADD content_hash CHAR(64)');
  await db.query('CREATE TABLE backend_locks (name VARCHAR(30) PRIMARY KEY)');
  await db.query('CREATE TABLE backend_migrations (name VARCHAR(150) PRIMARY KEY)');
  await migrate(db, { ...env, DATA_ENCRYPTION_KEY: key.toString('hex') });
  const [[user]] = await db.execute('SELECT nombre, password FROM usuarios WHERE id_usuario=?', [users.dueno]);
  assert.equal(user.nombre, 'Nombre anterior'); assert.equal(user.password, passwordHash);
  const [[active]] = await db.query('SELECT COUNT(*) AS count FROM sesiones_usuario WHERE revoked_at IS NULL');
  assert.equal(Number(active.count), 0);
  await migrate(db, env);
  const [tables] = await db.query("SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('backend_locks','backend_migrations')");
  assert.equal(tables.length, 0);
  const [hashColumns] = await db.query("SELECT column_name FROM information_schema.columns WHERE table_schema=DATABASE() AND table_name <> 'client_verifications' AND column_name LIKE '%hash%'");
  assert.equal(hashColumns.length, 0);
});
