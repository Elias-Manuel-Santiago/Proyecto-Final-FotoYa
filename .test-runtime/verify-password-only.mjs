import '../backend/node_modules/dotenv/dist/config.cjs';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import mysql from '../backend/node_modules/mysql2/promise.js';
import { decryptLegacy } from '../backend/scripts/lib/legacy-data.js';
const backup = JSON.parse(await readFile('../.test-runtime/before-password-only.json', 'utf8'));
const c = await mysql.createConnection({host:process.env.DB_HOST,port:Number(process.env.DB_PORT || 3306),user:process.env.DB_USER,password:process.env.DB_PASSWORD,database:process.env.DB_NAME,dateStrings:true,supportBigNumbers:true,bigNumberStrings:true});
try {
  const [extra] = await c.query("SELECT table_name FROM information_schema.tables WHERE table_schema=DATABASE() AND table_name IN ('backend_locks','backend_migrations')");
  assert.equal(extra.length, 0);
  const [hashes] = await c.query("SELECT column_name FROM information_schema.columns WHERE table_schema=DATABASE() AND column_name LIKE '%hash%'");
  assert.equal(hashes.length, 0);
  for (const [table, saved] of Object.entries(backup)) {
    if (['backend_locks','backend_migrations'].includes(table)) continue;
    const [[count]] = await c.query('SELECT COUNT(*) AS count FROM `' + table + '`');
    assert.equal(Number(count.count), saved.rows.length);
  }
  for (const old of backup.usuarios.rows) {
    const [[user]] = await c.execute('SELECT * FROM usuarios WHERE id_usuario=?', [old.id_usuario]);
    for (const field of ['nombre','apellido','email','dni']) {
      let expected = old[field].startsWith('enc:v1:') ? decryptLegacy(old[field], field, process.env) : old[field];
      if (field === 'email') expected = expected.trim().toLowerCase();
      if (field === 'dni') expected = expected.replace(/[.\s-]/g, '');
      assert.equal(user[field], expected);
    }
    assert.equal(user.password, old.password);
  }
  console.log('Verificado: tablas auxiliares ausentes, sin columnas hash, datos y contraseñas conservados, cantidades de registros sin cambios.');
} finally { await c.end(); }
