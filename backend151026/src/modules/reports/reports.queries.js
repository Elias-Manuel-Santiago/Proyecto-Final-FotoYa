import { stationScope } from '../../security/access.js';

export const salesByDay = '(SELECT id_dias, SUM(cantidad) AS sold, SUM(precio_total) AS revenue FROM venta GROUP BY id_dias)';

export function stationReport(actor, input) {
  const station = stationScope(actor, input.stationId), where = [], filters = [];
  for (const [column, value] of [['p.id_puesto', station], ['p.id_ciudad', input.cityId], ['p.id_evento', input.eventId]]) {
    if (value) { where.push(`${column} = ?`); filters.push(value); }
  }
  return {
    sql: `SELECT p.id_puesto AS stationId, p.nombre AS station,
      COALESCE(a.registeredDays, 0) AS registeredDays, DATEDIFF(?, ?) + 1 AS expectedDays,
      CASE WHEN a.registeredDays = DATEDIFF(?, ?) + 1 THEN a.taken END AS taken,
      a.taken AS registeredTaken, COALESCE(a.sold, 0) AS sold, COALESCE(a.revenue, 0) AS revenue,
      COALESCE(a.invalidDays, 0) AS invalidDays,
      CASE WHEN a.registeredDays = DATEDIFF(?, ?) + 1 AND a.invalidDays = 0 THEN a.taken - a.sold END AS discarded,
      CASE WHEN a.registeredDays = DATEDIFF(?, ?) + 1 AND a.taken > 0 AND a.invalidDays = 0
        THEN ROUND(a.sold / a.taken * 100, 2) END AS percentage
      FROM puesto p LEFT JOIN (SELECT d.id_puesto, COUNT(*) AS registeredDays, SUM(d.fotos) AS taken,
        SUM(COALESCE(v.sold, 0)) AS sold, SUM(COALESCE(v.revenue, 0)) AS revenue,
        SUM(CASE WHEN COALESCE(v.sold, 0) > d.fotos THEN 1 ELSE 0 END) AS invalidDays
        FROM dias d LEFT JOIN ${salesByDay} v ON v.id_dias = d.id_dias
        WHERE d.fecha BETWEEN ? AND ? GROUP BY d.id_puesto) a ON a.id_puesto = p.id_puesto
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''}`,
    params: [input.to, input.from, input.to, input.from, input.to, input.from, input.to, input.from, input.from, input.to, ...filters],
  };
}
