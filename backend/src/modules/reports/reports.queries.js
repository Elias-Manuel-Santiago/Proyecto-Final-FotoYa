/**
 * @file
 * Agrega ventas por día antes de unirlas con puestos. Conserva NULL en métricas
 * incompletas/inconsistentes y evita duplicar ventas por joins.
 */
import { stationScope } from '../../security/access.js';
import { periodDateFilter } from '../../shared/validation.js';

export const salesByDay = '(SELECT id_dias, SUM(IF(familia_contada, cantidad, 0)) AS sold, SUM(precio_total) AS revenue FROM venta GROUP BY id_dias)';

// Construye la consulta común de informes con filtros y agregados por puesto.
export function stationReport(actor, input) {
  const station = stationScope(actor, input.stationId), where = [], filters = [];
  for (const [column, value] of [['p.id_puesto', station], ['p.id_ciudad', input.cityId], ['p.id_evento', input.eventId]]) {
    if (value) { where.push(`${column} = ?`); filters.push(value); }
  }
  const dates = periodDateFilter(input, 'd.fecha');
  // Siempre suma los días registrados sin suponer fechas de apertura de cada puesto.
  const expected = input.allTime ? 'COALESCE(a.registeredDays, 0)' : 'DATEDIFF(?, ?) + 1';
  const complete = input.allTime ? 'a.registeredDays > 0' : 'a.registeredDays = DATEDIFF(?, ?) + 1';
  return {
    sql: `SELECT p.id_puesto AS stationId, p.nombre AS station,
      COALESCE(a.registeredDays, 0) AS registeredDays, ${expected} AS expectedDays,
      CASE WHEN ${complete} THEN a.taken END AS taken,
      a.taken AS registeredTaken, COALESCE(a.sold, 0) AS sold, COALESCE(a.revenue, 0) AS revenue,
      COALESCE(a.invalidDays, 0) AS invalidDays,
      CASE WHEN ${complete} AND a.invalidDays = 0 THEN a.taken - a.sold END AS discarded,
      CASE WHEN ${complete} AND a.taken > 0 AND a.invalidDays = 0
        THEN ROUND(a.sold / a.taken * 100, 2) END AS percentage
      FROM puesto p LEFT JOIN (SELECT d.id_puesto, COUNT(*) AS registeredDays, SUM(d.fotos) AS taken,
        SUM(COALESCE(v.sold, 0)) AS sold, SUM(COALESCE(v.revenue, 0)) AS revenue,
        SUM(CASE WHEN COALESCE(v.sold, 0) > d.fotos THEN 1 ELSE 0 END) AS invalidDays
        FROM dias d LEFT JOIN ${salesByDay} v ON v.id_dias = d.id_dias
        WHERE ${dates.sql} GROUP BY d.id_puesto) a ON a.id_puesto = p.id_puesto
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`,
    params: [...(input.allTime ? [] : [input.to, input.from, input.to, input.from, input.to, input.from, input.to, input.from]), ...dates.params, ...filters],
  };
}
