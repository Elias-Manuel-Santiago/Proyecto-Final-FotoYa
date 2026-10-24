/**
 * @file
 * Ejecuta conteos e informes según alcance. Calcula el resumen sobre todo el filtro, sin
 * depender de la página del listado.
 */
import { db } from '../../config/database.js';
import { stationScope } from '../../security/access.js';
import { salesByDay, stationReport } from './reports.queries.js';

// Cada venta se agrega antes de vincularla con los conteos diarios.
export const reportsRepository = {
  // Consulta conteos diarios y ventas del período dentro del alcance del actor.
  async days(actor, input) {
    const station = stationScope(actor, input.stationId);
    const [rows] = await db.execute(`SELECT d.id_dias AS id, d.id_puesto AS stationId, d.fecha AS date, d.fotos AS taken,
      COALESCE(v.sold, 0) AS sold, COALESCE(v.revenue, 0) AS revenue,
      CASE WHEN COALESCE(v.sold, 0) <= d.fotos THEN d.fotos - COALESCE(v.sold, 0) END AS discarded,
      CASE WHEN d.fotos > 0 AND COALESCE(v.sold, 0) <= d.fotos THEN ROUND(COALESCE(v.sold, 0) / d.fotos * 100, 2) END AS percentage
      FROM dias d LEFT JOIN ${salesByDay} v ON v.id_dias = d.id_dias
      WHERE d.fecha BETWEEN ? AND ? ${station ? 'AND d.id_puesto = ?' : ''}
      ORDER BY d.fecha DESC, d.id_puesto LIMIT ? OFFSET ?`,
    [input.from, input.to, ...(station ? [station] : []), String(input.limit), String(input.offset)]);
    return rows;
  },
  // Pagina el informe por puesto usando la consulta compartida de agregación.
  async query(actor, input) {
    const { sql, params } = stationReport(actor, input);
    const [rows] = await db.execute(`${sql} ORDER BY stationId LIMIT ? OFFSET ?`, [...params, String(input.limit), String(input.offset)]);
    return rows;
  },
  // Agrega el informe completo en el servidor para no sumar solamente una página.
  async summary(actor, input) {
    const { sql, params } = stationReport(actor, input);
    const [[row]] = await db.execute(`SELECT COUNT(*) AS stations,
      CASE WHEN COUNT(*) > 0 AND COUNT(taken) = COUNT(*) THEN SUM(taken) END AS taken,
      SUM(registeredTaken) AS registeredTaken, COALESCE(SUM(sold), 0) AS sold, COALESCE(SUM(revenue), 0) AS revenue,
      CASE WHEN COUNT(*) > 0 AND COUNT(discarded) = COUNT(*) THEN SUM(discarded) END AS discarded,
      CASE WHEN COUNT(taken) = COUNT(*) AND COUNT(discarded) = COUNT(*) AND SUM(taken) > 0
        THEN ROUND(SUM(sold) / SUM(taken) * 100, 2) END AS percentage FROM (${sql}) results`, params);
    return row;
  },
};
