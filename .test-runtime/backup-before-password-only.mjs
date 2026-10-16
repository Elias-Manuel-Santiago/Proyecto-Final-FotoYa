import '../backend/node_modules/dotenv/dist/config.cjs';
import { mkdir, writeFile } from 'node:fs/promises';
import mysql from '../backend/node_modules/mysql2/promise.js';
const connection = await mysql.createConnection({ host: process.env.DB_HOST, port: Number(process.env.DB_PORT || 3306), user: process.env.DB_USER, password: process.env.DB_PASSWORD, database: process.env.DB_NAME, dateStrings: true, supportBigNumbers: true, bigNumberStrings: true });
try {
  await connection.query('START TRANSACTION WITH CONSISTENT SNAPSHOT');
  const [tables] = await connection.query('SHOW TABLES');
  const backup = {};
  for (const table of tables.map(row => Object.values(row)[0])) {
    const quoted = '`' + table.replaceAll('`', '``') + '`';
    const [[schema]] = await connection.query('SHOW CREATE TABLE ' + quoted);
    const [rows] = await connection.query('SELECT * FROM ' + quoted);
    backup[table] = { schema: schema['Create Table'], rows };
  }
  await mkdir('../.test-runtime', { recursive: true });
  await writeFile('../.test-runtime/before-password-only.json', JSON.stringify(backup, null, 2), { flag: 'wx' });
  await connection.commit();
  console.log({ backedUpTables: Object.keys(backup).length, users: backup.usuarios.rows.length, encryptedUsers: backup.usuarios.rows.filter(row => ['nombre', 'apellido', 'email', 'dni'].some(field => row[field].startsWith('enc:v1:'))).length, conversionKeyAvailable: Boolean(process.env.DATA_ENCRYPTION_KEY) });
} finally { await connection.end(); }


