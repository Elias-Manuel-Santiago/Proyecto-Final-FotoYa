/** Converts the legacy photo role once, preserving its ID and permissions. */
import { rolePermissions } from '../../src/config/permissions.js';
import { seedPermissions } from './seed-permissions.js';

// Called inside the schema migration transaction and advisory lock.
export async function migrateEmployeeRoles(connection) {
  const [roles] = await connection.query('SELECT id_rol AS id, nombre AS name FROM rol FOR UPDATE');
  if (!roles.some(role => role.name === 'editor')) {
    const legacy = roles.find(role => role.name === 'camarografo');
    if (legacy) {
      // All existing users become Editors without changing their assignments or history.
      await connection.execute("UPDATE rol SET nombre = 'editor' WHERE id_rol = ?", [legacy.id]);
    }
  }
  // Rename before seeding, including legacy installations without permission rows.
  await seedPermissions(connection);
  const [current] = await connection.query('SELECT nombre AS name FROM rol');
  for (const role of ['editor', 'camarografo']) {
    if (!current.some(row => row.name === role)) await createRole(connection, role);
  }
}

async function createRole(connection, role) {
  await connection.execute('INSERT INTO rol (nombre) VALUES (?)', [role]);
  for (const permission of rolePermissions[role]) {
    await connection.execute('INSERT IGNORE INTO permisos (tipo_de_permiso) VALUES (?)', [permission]);
    await connection.execute(`INSERT IGNORE INTO permisos_rol (id_rol, id_permiso)
      SELECT r.id_rol, p.id_permisos FROM rol r CROSS JOIN permisos p
      WHERE r.nombre = ? AND p.tipo_de_permiso = ?`, [role, permission]);
  }
}
