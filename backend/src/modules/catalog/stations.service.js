/**
 * @file
 * Crea puestos desde eventos existentes y permite baja/reactivación. Revalida al dueño y
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
export const stations = {
  // El evento define nombre y ciudad; el alta nunca crea ubicaciones nuevas.
  create(actor, input) {
    return managed(actor, async connection => {
      const [[event]] = await connection.execute('SELECT id_evento AS id, nombre AS name, id_ciudad AS cityId FROM evento WHERE id_evento = ? FOR UPDATE', [input.eventId]);
      if (!event) throw new ApiError(404, 'El evento no existe.');
      const { name, cityId, id: eventId } = event;
      const [[duplicate]] = await connection.execute(`SELECT id_puesto FROM puesto
        WHERE nombre = ? AND id_ciudad = ? AND id_evento <=> ? LIMIT 1`,
      [name, cityId, eventId]);
      if (duplicate) throw new ApiError(409, 'El puesto ya existe. Si está inactivo, reactivalo.');
      const [result] = await connection.execute(`INSERT INTO puesto (nombre, id_ciudad, id_evento)
        VALUES (?, ?, ?)`, [name, cityId, eventId]);
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
