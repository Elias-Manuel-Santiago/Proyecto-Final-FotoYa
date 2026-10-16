import { rolePermissions } from '../../src/config/permissions.js';

export async function seedPermissions(connection) {
  const [[seeded]] = await connection.query('SELECT COUNT(*) AS count FROM permisos');
  if (Number(seeded.count)) return;
  for (const [role, permissions] of Object.entries(rolePermissions)) {
    await connection.execute('INSERT IGNORE INTO rol (nombre) VALUES (?)', [role]);
    for (const permission of permissions) {
      await connection.execute('INSERT IGNORE INTO permisos (tipo_de_permiso) VALUES (?)', [permission]);
      await connection.execute(`INSERT IGNORE INTO permisos_rol (id_rol, id_permiso)
        SELECT r.id_rol, p.id_permisos FROM rol r CROSS JOIN permisos p WHERE r.nombre = ? AND p.tipo_de_permiso = ?`, [role, permission]);
    }
  }
}
