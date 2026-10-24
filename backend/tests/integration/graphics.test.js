import { before, after, test } from 'node:test';
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import { randomBytes } from 'node:crypto';
import { migrate } from '../../scripts/migrate.js';
import { env as fixture, actor } from '../fixtures.js';

const enabled = process.env.TEST_DB_PORT;
const integration = (name, run) => test(name, { skip: !enabled }, run);
const database = `foto_ya_graphics_${randomBytes(6).toString('hex')}`;
let admin, db, repository, schema;
before(async () => {
  if (!enabled) return;
  const config = { ...fixture, DB_HOST: '127.0.0.1', DB_PORT: Number(enabled), DB_NAME: database, DB_USER: 'root', DB_PASSWORD: '' };
  admin = await mysql.createConnection({ host: config.DB_HOST, port: config.DB_PORT, user: config.DB_USER, password: config.DB_PASSWORD });
  await admin.query(`CREATE DATABASE \`${database}\``);
  const { env } = await import('../../src/config/env.js');
  Object.assign(env, config);
  ({ db } = await import('../../src/config/database.js'));
  await migrate(db, config, { init: true });
  ({ graphicsRepository: repository } = await import('../../src/modules/reports/graphics.repository.js'));
  ({ graphicsQuery: schema } = await import('../../src/modules/reports/reports.routes.js'));
  await db.query("INSERT INTO ciudad(nombre) VALUES ('Ciudad')");
  await db.query("INSERT INTO puesto(nombre,direccion,id_ciudad) VALUES ('Uno','A',1),('Dos','B',1)");
  await db.query(`INSERT INTO usuarios(nombre,apellido,email,dni,password,id_rol,id_puesto)
    SELECT 'Vendedor','Uno','seller@example.com','100','unused',id_rol,1 FROM rol WHERE nombre='vendedor'`);
  await db.query(`INSERT INTO usuarios(nombre,apellido,email,dni,password,id_rol,id_puesto)
    SELECT 'Cámara','Uno','camera@example.com','200','unused',id_rol,1 FROM rol WHERE nombre='camarografo'`);
  await db.query("INSERT INTO dias(fecha,fotos,descartes,id_puesto) VALUES ('2026-10-24',3,1,1),('2026-10-24',1,0,2),('2026-10-23',0,0,1)");
  await db.query(`INSERT INTO fotos(id_archivo,id_dia,id_puesto,id_camarografo,created_at) VALUES
    ('one.jpg',1,1,2,'2026-10-24 15:15:00'),('two.jpg',1,1,2,'2026-10-24 16:15:00'),('legacy.jpg',1,1,NULL,NULL)`);
  await db.query(`INSERT INTO venta(cantidad,precio_total,id_dias,id_vendedor,familia_contada,created_at) VALUES
    (1,100,1,1,1,'2026-10-24 15:30:00'),(1,50,1,1,0,'2026-10-24 15:40:00'),(1,200,1,1,1,NULL),(1,999,2,NULL,1,NULL)`);
  await db.query('INSERT INTO fotos_venta(id_foto,id_venta) VALUES (1,1),(1,2),(2,3)');
  // Dos turnos solapados no duplican las oportunidades del vendedor.
  await db.query(`INSERT INTO horarios(id_dias,id_usuario,check_in,check_out) VALUES
    (1,1,'2026-10-24 15:00:00','2026-10-24 17:00:00'),(1,1,'2026-10-24 15:00:00','2026-10-24 16:00:00'),
    (3,2,'2026-10-24 02:00:00','2026-10-24 04:00:00')`);
});
after(async () => {
  if (db) await db.end();
  if (admin) { await admin.query(`DROP DATABASE \`${database}\``); await admin.end(); }
});
const period = { from: '2026-10-24', to: '2026-10-24', day: '2026-10-24' };

integration('gráficos MySQL: agrega operaciones, familias e importes sin duplicar fotos en compras repetidas', async () => {
  const result = await repository.query(actor('encargado', { stationId: '1' }), period);
  assert.equal(result.days.length, 1);
  assert.equal(Number(result.days[0].sales), 3);
  assert.equal(Number(result.days[0].sold), 2);
  assert.equal(Number(result.days[0].earnings), 350);
  assert.equal(Number(result.days[0].taken), 3);
  const camera = result.people.find(r => r.employeeId === '2');
  assert.equal(Number(camera.taken), 2);
  assert.equal(Number(camera.sales), 3);
  assert.equal(Number(camera.sold), 2);
  assert.equal(Number(camera.earnings), 350);
  const seller = result.people.find(r => r.role === 'seller');
  assert.equal(Number(seller.opportunityTaken), 2);
  assert.equal(Number(seller.missingTimes), 1);
});

integration('gráficos MySQL: horas argentinas, histórico sin hora y turnos del día anterior', async () => {
  const result = await repository.query(actor('encargado', { stationId: '1' }), period);
  const noon = result.hours.find(r => r.hour !== null && Number(r.hour) === 12);
  assert.equal(Number(noon.earnings), 150);
  assert.equal(Number(noon.sales), 2);
  assert.equal(Number(noon.sold), 1);
  assert.equal(Number(noon.taken), 1);
  const unknown = result.hours.find(r => r.hour === null);
  assert.equal(Number(unknown.earnings), 200);
  assert.equal(Number(unknown.taken), 1);
  assert(result.attendance.some(r => r.employeeId === '2' && r.checkIn.startsWith('2026-10-24 02:00')));
});

integration('gráficos MySQL: alcance aplicado a días, horas, personal y rendimiento; rechaza otro puesto', async () => {
  const manager = actor('encargado', { stationId: '1' });
  await assert.rejects(repository.query(manager, { ...period, stationId: '2' }), { status: 403 });
  const result = await repository.query(manager, period);
  for (const rows of Object.values(result)) assert(rows.every(r => r.stationId === '1'));
  const global = await repository.query(actor('dueno'), period);
  assert.equal(global.days.length, 2);
  assert.equal(schema.safeParse({ ...period, day: '2026-10-23' }).success, false);
  assert.equal(schema.safeParse({ ...period, stationId: '1 OR 1=1' }).success, false);
});
