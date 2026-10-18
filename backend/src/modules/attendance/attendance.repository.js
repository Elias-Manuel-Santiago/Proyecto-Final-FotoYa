import { db } from '../../config/database.js';
import { stationScope } from '../../security/access.js';

export const attendanceRepository = {
  async query(actor, input, self = false) {
    const station = self && actor.role !== 'encargado' ? null : stationScope(actor, input.stationId);
    const params = [input.from, input.to];
    const where = ['d.fecha BETWEEN ? AND ?'];
    if (station) { where.push('d.id_puesto = ?'); params.push(station); }
    if (self || input.userId) { where.push('h.id_usuario = ?'); params.push(self ? actor.id : input.userId); }
    const [rows] = await db.execute(`SELECT h.id_horario AS id, h.id_usuario AS userId, d.id_puesto AS stationId,
      d.fecha AS date, h.check_in AS checkIn, h.check_out AS checkOut,
      CASE WHEN h.check_out IS NOT NULL THEN TIMESTAMPDIFF(SECOND, h.check_in, h.check_out) END AS durationSeconds
      FROM horarios h JOIN dias d ON d.id_dias = h.id_dias JOIN usuarios u ON u.id_usuario = h.id_usuario
      JOIN rol r ON r.id_rol = u.id_rol WHERE r.nombre <> 'cliente' AND ${where.join(' AND ')}
      ORDER BY h.check_in DESC, h.id_horario DESC LIMIT ? OFFSET ?`, [...params, String(input.limit), String(input.offset)]);
    return rows;
  },
};
