/**
 * @file
 * Crea puestos reutilizando ciudad/evento y permite baja/reactivación. Revalida al dueño y
 * evita duplicar también puestos inactivos.
 */
import { ApiError } from '../../shared/errors.js';
import { transaction } from '../../shared/transaction.js';
import { assertPermission } from '../../security/access.js';

// Revalida al dueño y su sesión dentro de la transacción que administra el puesto.
export const managed = (actor, callback) => {
  assertPermission(actor, 'stations.manage');
  if (actor.role !== 'dueno') throw new ApiError(403, 'Solo el administrador puede gestionar puestos.');
  return transaction(async connection => {
    // Comparte el orden de bloqueo con la gestión de usuarios.
    await connection.query('SELECT id_rol FROM rol ORDER BY id_rol FOR UPDATE');
    const [[authorized]] = await connection.execute(`SELECT u.id_usuario FROM usuarios u
      JOIN rol r ON r.id_rol = u.id_rol JOIN permisos_rol pr ON pr.id_rol = r.id_rol
      JOIN permisos p ON p.id_permisos = pr.id_permiso
      JOIN sesiones_usuario s ON s.id_usuario = u.id_usuario
      WHERE u.id_usuario = ? AND u.disponible = 1 AND r.nombre = 'dueno'
      AND p.tipo_de_permiso = 'stations.manage' AND s.id_sesiones_usuario = ?
      AND s.check_in_mode = FALSE AND s.revoked_at IS NULL AND s.expires_at > UTC_TIMESTAMP(6)`, [actor.id, actor.sessionId]);
    if (!authorized) throw new ApiError(403, 'La autorización cambió. Volvé a iniciar sesión.');
    return callback(connection);
  });
};
// Reutiliza o crea ciudad/evento por nombre con identificadores SQL definidos por el servicio.
const reference = async (connection, table, key, name) => {
  const [[existing]] = await connection.execute(`SELECT ${key} AS id FROM ${table} WHERE nombre = ? ORDER BY ${key} LIMIT 1`, [name]);
  if (existing) return existing.id;
  const [created] = await connection.execute(`INSERT INTO ${table} (nombre) VALUES (?)`, [name]);
  return created.insertId;
};
export const stations = {
  // Resuelve ciudad y evento y rechaza duplicados antes de crear el puesto.
  create(actor, input) {
    return managed(actor, async connection => {
      const cityId = await reference(connection, 'ciudad', 'id_ciudad', input.city);
      let eventId = null;
      if (input.event) {
        const [[existing]] = await connection.execute('SELECT id_evento AS id, id_ciudad AS cityId FROM evento WHERE nombre = ? ORDER BY id_evento LIMIT 1 FOR UPDATE', [input.event]);
        if (existing && String(existing.cityId) !== String(cityId)) throw new ApiError(409, 'El evento pertenece a otra ciudad.');
        if (existing) eventId = existing.id;
        else {
          const [created] = await connection.execute('INSERT INTO evento (nombre, id_ciudad) VALUES (?, ?)', [input.event, cityId]);
          eventId = created.insertId;
        }
      }
      const [[duplicate]] = await connection.execute(`SELECT id_puesto FROM puesto
        WHERE nombre = ? AND id_ciudad = ? AND id_evento <=> ? LIMIT 1`,
      [input.name, cityId, eventId]);
      if (duplicate) throw new ApiError(409, 'El puesto ya existe. Si está inactivo, reactivalo.');
      const [result] = await connection.execute(`INSERT INTO puesto (nombre, id_ciudad, id_evento)
        VALUES (?, ?, ?)`, [input.name, cityId, eventId]);
      return { id: String(result.insertId), active: true };
    });
  },
  // Modifica disponibilidad conservando relaciones e historial del puesto.
  setActive(actor, input) {
    return managed(actor, async connection => {
      const [[station]] = await connection.execute('SELECT id_puesto FROM puesto WHERE id_puesto = ? FOR UPDATE', [input.stationId]);
      if (!station) throw new ApiError(404, 'El puesto no existe.');
      await connection.execute('UPDATE puesto SET disponible = ? WHERE id_puesto = ?', [input.active, input.stationId]);
      return { id: input.stationId, active: input.active };
    });
  },
};
