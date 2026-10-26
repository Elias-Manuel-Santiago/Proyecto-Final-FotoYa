import { test } from 'node:test';
import assert from 'node:assert/strict';
import mysql from 'mysql2/promise';
import { randomBytes } from 'node:crypto';
import { migrate } from '../../scripts/migrate.js';
import { env as fixture } from '../fixtures.js';

test('la migración convierte cuentas antiguas una sola vez y conserva permisos e historial', { skip: !process.env.TEST_DB_PORT }, async () => {
  const config = { ...fixture, DB_NAME: `foto_ya_roles_${randomBytes(6).toString('hex')}` };
  const options = { host: process.env.TEST_DB_HOST ?? '127.0.0.1', port: Number(process.env.TEST_DB_PORT),
    user: process.env.TEST_DB_USER ?? 'root', password: process.env.TEST_DB_PASSWORD ?? '' };
  const admin = await mysql.createConnection(options);
  let db;
  try {
    await admin.query(`CREATE DATABASE \`${config.DB_NAME}\``);
    db = mysql.createPool({ ...options, database: config.DB_NAME });
    await migrate(db, config, { init: true });
    const roles = async () => (await db.query('SELECT id_rol AS id,nombre AS name FROM rol'))[0];
    assert.equal((await roles()).length, 7);
    const editorId = (await roles()).find(row => row.name === 'editor').id;
    const cameraId = (await roles()).find(row => row.name === 'camarografo').id;
    // Recreate an installation with the legacy photo role and a customized permission set.
    await db.execute('DELETE FROM permisos_rol WHERE id_rol=?', [cameraId]);
    await db.execute('DELETE FROM rol WHERE id_rol=?', [cameraId]);
    await db.execute("UPDATE rol SET nombre='camarografo' WHERE id_rol=?", [editorId]);
    await db.execute(`DELETE pr FROM permisos_rol pr JOIN permisos p ON p.id_permisos=pr.id_permiso
      WHERE pr.id_rol=? AND p.tipo_de_permiso='photos.assign'`, [editorId]);
    await db.execute(`INSERT INTO usuarios(nombre,apellido,email,dni,password,id_rol)
      VALUES ('Legacy','Editor','legacy@example.com','12345678','unused',?)`, [editorId]);
    const permissions = async role => (await db.execute(`SELECT p.tipo_de_permiso AS name FROM permisos p
      JOIN permisos_rol pr ON pr.id_permiso=p.id_permisos JOIN rol r ON r.id_rol=pr.id_rol
      WHERE r.nombre=? ORDER BY p.tipo_de_permiso`, [role]))[0].map(row => row.name);
    const original = await permissions('camarografo');
    await migrate(db, config);
    assert.equal((await roles()).find(row => row.name === 'editor').id, editorId);
    assert.deepEqual(await permissions('editor'), original);
    assert.deepEqual(await permissions('camarografo'), ['attendance.self', 'catalog.read', 'counts.read', 'sales.read']);
    const [[legacy]] = await db.query("SELECT r.nombre AS role FROM usuarios u JOIN rol r ON r.id_rol=u.id_rol WHERE email='legacy@example.com'");
    assert.equal(legacy.role, 'editor');
    const newCameraId = (await roles()).find(row => row.name === 'camarografo').id;
    await db.execute(`INSERT INTO usuarios(nombre,apellido,email,dni,password,id_rol)
      VALUES ('New','Camera','new@example.com','23456789','unused',?)`, [newCameraId]);
    await migrate(db, config);
    assert.equal((await roles()).find(row => row.name === 'camarografo').id, newCameraId);
    const [[newUser]] = await db.query("SELECT id_rol AS roleId FROM usuarios WHERE email='new@example.com'");
    assert.equal(newUser.roleId, newCameraId);
    assert.deepEqual(await permissions('editor'), original);
  } finally {
    if (db) await db.end();
    await admin.query(`DROP DATABASE IF EXISTS \`${config.DB_NAME}\``);
    await admin.end();
  }
});
