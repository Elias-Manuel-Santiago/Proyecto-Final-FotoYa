/**
 * @file
 * Lee metadatos por período, puesto y cliente sin generar URLs. find admite conexión
 * transaccional y bloqueo para escrituras coordinadas.
 */
import { db } from '../../config/database.js';
const columns = `f.id_fotos AS id, f.id_cliente AS clientId,
  COALESCE(f.email_cliente, (SELECT email FROM usuarios WHERE id_usuario = f.id_cliente)) AS clientEmail,
  f.id_puesto AS stationId, d.fecha AS date`;
export const photoRepository = {
  // Pagina metadatos por período, puesto y destinatario según el actor.
  async query(actor, input, station) {
    const params = [input.from, input.to], where = ['d.fecha BETWEEN ? AND ?'];
    if (actor.role === 'cliente') { where.push('f.id_cliente = ?'); params.push(actor.id); }
    else {
      if (station) { where.push('f.id_puesto = ?'); params.push(station); }
      if (input.clientId) { where.push('f.id_cliente = ?'); params.push(input.clientId); }
      if (input.unassigned) where.push('f.id_cliente IS NULL');
    }
    const [rows] = await db.execute(`SELECT ${columns} FROM fotos f JOIN dias d ON d.id_dias = f.id_dia
      WHERE ${where.join(' AND ')} ORDER BY f.id_fotos DESC LIMIT ? OFFSET ?`, [...params, String(input.limit), String(input.offset)]);
    return rows;
  },
  // Busca metadatos y ruta privada con opción de conexión transaccional y bloqueo.
  async find(photoId, executor = db, lock = false) {
    const [[row]] = await executor.execute(`SELECT ${columns}, f.id_archivo AS file FROM fotos f
      JOIN dias d ON d.id_dias = f.id_dia WHERE f.id_fotos = ? ${lock ? 'FOR UPDATE' : ''}`, [photoId]);
    return row;
  },
};
