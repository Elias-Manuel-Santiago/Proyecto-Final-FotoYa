import { transaction } from '../../shared/transaction.js';
import { assertPermission } from '../../security/access.js';
import { ApiError } from '../../shared/errors.js';

export function defineDuration(actor, input) {
  assertPermission(actor, 'attendance.read');
  if (actor.role !== 'secretario') throw new ApiError(403, 'Solo el secretario puede completar una duración.');
  return transaction(async connection => {
    const [[authorized]] = await connection.execute(`SELECT u.id_usuario FROM usuarios u
      JOIN rol r ON r.id_rol=u.id_rol JOIN permisos_rol pr ON pr.id_rol=r.id_rol
      JOIN permisos p ON p.id_permisos=pr.id_permiso JOIN sesiones_usuario s ON s.id_usuario=u.id_usuario
      WHERE u.id_usuario=? AND u.disponible=1 AND r.nombre='secretario' AND p.tipo_de_permiso='attendance.read'
      AND s.id_sesiones_usuario=? AND s.check_in_mode=FALSE AND s.revoked_at IS NULL AND s.expires_at>UTC_TIMESTAMP(6) FOR UPDATE`, [actor.id, actor.sessionId]);
    if (!authorized) throw new ApiError(403, 'La autorización cambió. Volvé a iniciar sesión.');
    const [[record]] = await connection.execute(`SELECT h.id_horario AS id,h.check_out AS checkOut,r.nombre AS role
      FROM horarios h JOIN usuarios u ON u.id_usuario=h.id_usuario JOIN rol r ON r.id_rol=u.id_rol
      WHERE h.id_horario=? FOR UPDATE`, [input.attendanceId]);
    if (!record || ['cliente', 'dueno'].includes(record.role)) throw new ApiError(404, 'El horario no existe.');
    if (record.checkOut !== null) throw new ApiError(409, 'El turno ya tiene check-out. Actualizá la tabla.');
    const manualMinutes = input.hours * 60 + input.minutes;
    await connection.execute(`UPDATE horarios SET manual_minutes=?,manual_minutes_by=?,manual_minutes_at=UTC_TIMESTAMP(6)
      WHERE id_horario=?`, [manualMinutes, actor.id, input.attendanceId]);
    return { id: input.attendanceId, manualMinutes };
  });
}
