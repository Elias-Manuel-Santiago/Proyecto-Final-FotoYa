/**
 * @file
 * Consulta horarios por período y alcance. La consulta propia conserva registros de puestos
 * anteriores del usuario.
 */
import { db } from '../../config/database.js';
import { ApiError } from '../../shared/errors.js';
import { assertPermission, stationScope } from '../../security/access.js';

export const attendanceRepository = {
  employeeHistory(actor, input) {
    assertPermission(actor, 'attendance.read');
    if (!['dueno', 'secretario'].includes(actor.role)) throw new ApiError(403, 'Solo el dueño y el secretario pueden consultar el historial completo.');
    return this.query(actor, input, false, true);
  },
  // Consulta turnos por período y alcance; la variante self restringe al propio usuario.
  async query(actor, input, self = false, allHistory = false) {
    const station = self && actor.role !== 'encargado' ? null : stationScope(actor, input.stationId);
    const unlimited = allHistory || input.allTime;
    const params = unlimited ? [] : [input.from, input.to];
    const where = unlimited ? ['1 = 1'] : ['d.fecha BETWEEN ? AND ?'];
    if (actor.role === 'secretario') where.push("r.nombre <> 'dueno'");
    if (station) { where.push('d.id_puesto = ?'); params.push(station); }
    if (self || input.userId) { where.push('h.id_usuario = ?'); params.push(self ? actor.id : input.userId); }
    const [rows] = await db.execute(`SELECT h.id_horario AS id, h.id_usuario AS userId, d.id_puesto AS stationId,
      d.fecha AS date, h.check_in AS checkIn, h.check_out AS checkOut, h.closed_at AS closedAt, h.manual_minutes AS manualMinutes, h.manual_minutes_by AS manualMinutesBy, h.manual_minutes_at AS manualMinutesAt,
      CASE WHEN h.check_out IS NOT NULL THEN TIMESTAMPDIFF(SECOND, h.check_in, h.check_out) END AS durationSeconds
      FROM horarios h JOIN dias d ON d.id_dias = h.id_dias JOIN usuarios u ON u.id_usuario = h.id_usuario
      JOIN rol r ON r.id_rol = u.id_rol WHERE r.nombre <> 'cliente' AND ${where.join(' AND ')}
      ORDER BY h.check_in DESC, h.id_horario DESC LIMIT ? OFFSET ?`, [...params, String(input.limit), String(input.offset)]);
    return rows;
  },
};
