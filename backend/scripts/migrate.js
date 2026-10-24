/**
 * @file
 * Actualiza el esquema inspeccionando columnas/índices bajo bloqueo MySQL. --init importa la
 * base vacía antes de aplicar extensiones y conversiones.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { protectUsers } from './lib/protect-users.js';
import { seedPermissions } from './lib/seed-permissions.js';
import { migrateVerifications } from './lib/migrate-verifications.js';

// Inspeccionar el esquema permite repetir la actualización sin tablas auxiliares.
export async function migrate(db, env, { init = false } = {}) {
  const connection = await db.getConnection();
  let acquired = false;
  const columns = async table => {
    const [rows] = await connection.execute('SELECT COLUMN_NAME AS name, IS_NULLABLE AS nullable FROM information_schema.columns WHERE table_schema = DATABASE() AND table_name = ?', [table]);
    return rows;
  };
  const hasColumn = async (table, name) => (await columns(table)).some(column => column.name === name);
  const hasIndex = async (table, name) => {
    const [rows] = await connection.execute('SELECT 1 FROM information_schema.statistics WHERE table_schema = DATABASE() AND table_name = ? AND index_name = ?', [table, name]);
    return rows.length > 0;
  };
  const runFile = async path => {
    const sql = await readFile(new URL(path, import.meta.url), 'utf8');
    for (const statement of sql.split(';').map(s => s.trim()).filter(Boolean)) await connection.query(statement);
  };
  try {
    const [[lock]] = await connection.query("SELECT GET_LOCK('foto_ya_schema', 10) AS acquired");
    acquired = Boolean(Number(lock.acquired));
    if (!acquired) throw new Error('Otra migración está ejecutándose.');
    if (init) {
      if ((await columns('usuarios')).length) throw new Error('La base ya está inicializada. Usá db:migrate.');
      await runFile('../../database/foto_ya.sql');
    }
    await connection.beginTransaction();
    await protectUsers(connection, env);
    await connection.commit();
    for (const column of ['email_hash', 'dni_hash']) {
      if (await hasColumn('usuarios', column)) await connection.query(`ALTER TABLE usuarios DROP COLUMN ${column}`);
    }
    for (const [name, column, length] of [['uq_usuarios_email', 'email', 254], ['uq_usuarios_dni', 'dni', 20]]) {
      if (!await hasIndex('usuarios', name)) await connection.query(`ALTER TABLE usuarios ADD CONSTRAINT ${name} UNIQUE (${column}(${length}))`);
    }
    for (const [table, oldIndex, newIndex, id, status, prefix] of [
      ['sesiones_usuario', 'uq_sesiones_hash', 'uq_sesiones_token', 'id_sesiones_usuario', 'revoked_at', 'invalid-session-'],
      ['tokens_autenticacion', 'uq_tokens_hash', 'uq_tokens_token', 'id_tokens', 'used_at', 'invalid-token-'],
    ]) {
      if (await hasColumn(table, 'token_hash')) {
        // Los tokens originales no son recuperables: invalidar credenciales anteriores.
        await connection.query(`UPDATE ${table} SET ${status} = COALESCE(${status}, UTC_TIMESTAMP(6))`);
        await connection.query(`UPDATE ${table} SET token_hash = CONCAT('${prefix}', ${id})`);
        await connection.query(`ALTER TABLE ${table} CHANGE token_hash token VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NOT NULL`);
      }
      if (await hasIndex(table, oldIndex)) await connection.query(`ALTER TABLE ${table} DROP INDEX ${oldIndex}`);
      if (!await hasIndex(table, newIndex)) await connection.query(`ALTER TABLE ${table} ADD CONSTRAINT ${newIndex} UNIQUE (token)`);
    }
    if (!await hasColumn('puesto', 'disponible')) await connection.query('ALTER TABLE puesto ADD disponible BOOLEAN NOT NULL DEFAULT TRUE');
    if (!await hasColumn('sesiones_usuario', 'check_in_mode')) await connection.query('ALTER TABLE sesiones_usuario ADD check_in_mode BOOLEAN NOT NULL DEFAULT FALSE');
    // Cierre administrativo por falta de check-out; nunca inventa una hora de salida.
    if (!await hasColumn('horarios', 'closed_at')) await connection.query(`ALTER TABLE horarios ADD closed_at DATETIME(6) NULL,
      ADD CONSTRAINT ck_horarios_cierre CHECK (closed_at IS NULL OR (check_out IS NULL AND closed_at >= check_in))`);
    if (!await hasIndex('horarios', 'ix_horarios_usuario_abierto')) await connection.query('CREATE INDEX ix_horarios_usuario_abierto ON horarios (id_usuario, check_out)');
    // Las tarifas antiguas quedan sin asignar: nunca se convierten en tarifas globales.
    if (!await hasColumn('precios', 'id_puesto')) await connection.query('ALTER TABLE precios ADD id_puesto BIGINT UNSIGNED NULL, ADD CONSTRAINT fk_precios_puesto FOREIGN KEY (id_puesto) REFERENCES puesto (id_puesto)');
    if (!await hasColumn('precios', 'disponible')) await connection.query('ALTER TABLE precios ADD disponible BOOLEAN NOT NULL DEFAULT TRUE');
    for (const [name, definition] of [
      ['operation_id', 'CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NULL'],
      ['request_data', 'TEXT NULL'], ['id_vendedor', 'BIGINT UNSIGNED NULL'],
      ['metodo_pago', 'VARCHAR(20) NULL'], ['copias', 'INT UNSIGNED NULL'],
      ['familia_contada', 'BOOLEAN NOT NULL DEFAULT TRUE'],
      ['created_at', 'DATETIME(6) NULL'],
    ]) {
      if (!await hasColumn('venta', name)) await connection.query(`ALTER TABLE venta ADD ${name} ${definition}`);
    }
    if (!await hasIndex('venta', 'uq_venta_operation')) await connection.query('CREATE UNIQUE INDEX uq_venta_operation ON venta (operation_id)');
    if (!await hasColumn('usuarios', 'email_verified')) await connection.query('ALTER TABLE usuarios ADD email_verified BOOLEAN NOT NULL DEFAULT TRUE');
    // Las copias de contraseñas heredadas se conservan, pero ya no se crean ni se usan.
    if ((await columns('usuarios')).some(column => column.name === 'dni' && column.nullable === 'NO'))
      await connection.query('ALTER TABLE usuarios MODIFY dni VARCHAR(20) NULL');
    if (!await hasColumn('usuarios', 'auth0_sub')) await connection.query('ALTER TABLE usuarios ADD auth0_sub VARCHAR(255) CHARACTER SET ascii COLLATE ascii_bin NULL UNIQUE');
    await migrateVerifications(connection, { hasColumn, hasIndex });
    if (!await hasColumn('fotos', 'email_cliente')) await connection.query('ALTER TABLE fotos ADD email_cliente VARCHAR(254) NULL');
    // No se reconstruyen autor ni hora de fotos históricas: permanecen desconocidos.
    if (!await hasColumn('fotos', 'id_camarografo')) await connection.query('ALTER TABLE fotos ADD id_camarografo BIGINT UNSIGNED NULL');
    if (!await hasColumn('fotos', 'created_at')) await connection.query('ALTER TABLE fotos ADD created_at DATETIME(6) NULL');
    if (!await hasIndex('fotos', 'ix_fotos_dia_autor_hora')) await connection.query('CREATE INDEX ix_fotos_dia_autor_hora ON fotos (id_dia, id_camarografo, created_at)');
    const photoColumns = await columns('fotos');
    if (photoColumns.some(column => column.name === 'id_cliente' && column.nullable === 'NO')) {
      const [keys] = await connection.query("SELECT CONSTRAINT_NAME AS name FROM information_schema.key_column_usage WHERE table_schema = DATABASE() AND table_name = 'fotos' AND column_name = 'id_cliente' AND referenced_table_name = 'usuarios'");
      for (const key of keys) await connection.query(`ALTER TABLE fotos DROP FOREIGN KEY \`${key.name.replaceAll('`', '``')}\``);
      await connection.query('ALTER TABLE fotos MODIFY id_cliente BIGINT UNSIGNED NULL, ADD CONSTRAINT fk_fotos_cliente_optional FOREIGN KEY (id_cliente) REFERENCES usuarios (id_usuario)');
    }
    const indexes = await readFile(new URL('../database/002-query-indexes.sql', import.meta.url), 'utf8');
    for (const statement of indexes.split(';').map(s => s.trim()).filter(Boolean)) {
      const [, name, table] = /CREATE INDEX (\w+) ON (\w+)/.exec(statement);
      if (!await hasIndex(table, name)) await connection.query(statement);
    }
    if (!await hasIndex('fotos', 'ix_fotos_puesto_cliente')) await connection.query('CREATE INDEX ix_fotos_puesto_cliente ON fotos (id_puesto, id_cliente, id_fotos)');
    await connection.beginTransaction();
    await seedPermissions(connection);
    // Check-in pertenece a la sesión del encargado. Una migración nunca libera un kiosco.
    for (const name of ['clients.read', 'clients.manage']) {
      const [inserted] = await connection.execute('INSERT IGNORE INTO permisos (tipo_de_permiso) VALUES (?)', [name]);
      if (inserted.affectedRows) await connection.execute(`INSERT IGNORE INTO permisos_rol (id_rol, id_permiso)
        SELECT r.id_rol, p.id_permisos FROM rol r CROSS JOIN permisos p WHERE r.nombre = 'dueno' AND p.tipo_de_permiso = ?`, [name]);
    }
    const [pricePermission] = await connection.execute("INSERT IGNORE INTO permisos (tipo_de_permiso) VALUES ('prices.manage')");
    if (pricePermission.affectedRows) await connection.execute(`INSERT IGNORE INTO permisos_rol (id_rol, id_permiso)
      SELECT r.id_rol, p.id_permisos FROM rol r CROSS JOIN permisos p
      WHERE r.nombre IN ('dueno', 'encargado') AND p.tipo_de_permiso = 'prices.manage'`);
    await connection.execute("INSERT IGNORE INTO permisos (tipo_de_permiso) VALUES ('stations.manage')");
    await connection.execute(`INSERT IGNORE INTO permisos_rol (id_rol, id_permiso)
      SELECT r.id_rol, p.id_permisos FROM rol r CROSS JOIN permisos p
      WHERE r.nombre = 'dueno' AND p.tipo_de_permiso = 'stations.manage'`);
    await connection.commit();
    // Se retiran sólo después de convertir correctamente los datos existentes.
    await connection.query('DROP TABLE IF EXISTS backend_locks');
    await connection.query('DROP TABLE IF EXISTS backend_migrations');
    // Las fotos confirmadas y sus archivos se conservan; ya no hay reservas de carga.
    await connection.query('DROP TABLE IF EXISTS photo_uploads');
    // La apertura/cierre es volátil y vive en la caché del proceso.
    await connection.query('DROP TABLE IF EXISTS event_sales');
  } catch (error) { await connection.rollback().catch(() => {}); throw error; }
  finally {
    if (acquired) await connection.query("SELECT RELEASE_LOCK('foto_ya_schema')").catch(() => {});
    connection.release();
  }
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { env: config } = await import('../src/config/env.js');
  const { db } = await import('../src/config/database.js');
  const env = { ...config, DATA_ENCRYPTION_KEY: process.env.DATA_ENCRYPTION_KEY };
  try { await migrate(db, env, { init: process.argv.includes('--init') }); console.log('Esquema actualizado; Check-in habilitado por sesión del encargado.'); }
  catch (error) { console.error({ code: error.code ?? 'MIGRATION_ERROR', message: error.code ? 'La migración falló. Revisá el esquema y sus restricciones.' : error.message }); process.exitCode = 1; }
  finally { await db.end(); }
}
