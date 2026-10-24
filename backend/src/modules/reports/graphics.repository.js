/** Agregados completos para gráficos, sin paginar ventas ni exponer fotos privadas. */
import { transaction } from '../../shared/transaction.js';
import { stationScope } from '../../security/access.js';

// Las horas SQL son UTC. El día comercial se conserva incluso en registros históricos inconsistentes.
const hour = column => `CASE WHEN DATE(DATE_SUB(${column}, INTERVAL 3 HOUR)) = d.fecha
  THEN HOUR(DATE_SUB(${column}, INTERVAL 3 HOUR)) END`;
const opportunities = employee => `(SELECT COUNT(*) FROM fotos f JOIN dias fd ON fd.id_dias=f.id_dia
  WHERE fd.id_puesto=d.id_puesto AND fd.fecha BETWEEN ? AND ? AND f.created_at IS NOT NULL
  AND EXISTS(SELECT 1 FROM horarios h JOIN dias hd ON hd.id_dias=h.id_dias
    WHERE h.id_usuario=${employee} AND hd.id_puesto=fd.id_puesto
    AND h.check_in <= f.created_at AND (h.check_out IS NULL OR h.check_out > f.created_at)))`;
const missingTimes = `(SELECT COALESCE(SUM(GREATEST(fd.fotos-(SELECT COUNT(*) FROM fotos f
  WHERE f.id_dia=fd.id_dias AND f.created_at IS NOT NULL),0)),0) FROM dias fd
  WHERE fd.id_puesto=d.id_puesto AND fd.fecha BETWEEN ? AND ?)`;

export const graphicsRepository = {
  async query(actor, input) {
    const station = stationScope(actor, input.stationId);
    // Todos los niveles se leen desde el mismo snapshot, incluso mientras se confirman ventas/cargas.
    return transaction(async connection => {
    const scope = station ? ' AND d.id_puesto = ?' : '';
    const params = [input.from, input.to, ...(station ? [station] : [])];
    const [days] = await connection.execute(`SELECT d.fecha AS date, d.id_puesto AS stationId, d.fotos AS taken,
      COUNT(v.id_venta) AS sales, COALESCE(SUM(v.precio_total),0) AS earnings,
      COALESCE(SUM(IF(v.familia_contada,v.cantidad,0)),0) AS sold
      FROM dias d LEFT JOIN venta v ON v.id_dias=d.id_dias
      WHERE d.fecha BETWEEN ? AND ?${scope}
      GROUP BY d.id_dias,d.fecha,d.id_puesto,d.fotos ORDER BY d.fecha, d.id_puesto`, params);

    // Una fila por empleado y puesto histórico. EXISTS evita duplicar fotos por turnos superpuestos.
    const [sellers] = await connection.execute(`SELECT d.id_puesto AS stationId, v.id_vendedor AS employeeId,
      'seller' AS role, COALESCE(CONCAT(u.nombre,' ',u.apellido),'Sin vendedor registrado') AS name,
      COUNT(*) AS sales, SUM(v.precio_total) AS earnings, SUM(IF(v.familia_contada,v.cantidad,0)) AS sold,
      NULL AS taken,
      ${opportunities('v.id_vendedor')} AS opportunityTaken,
      ${missingTimes} AS missingTimes
      FROM venta v JOIN dias d ON d.id_dias=v.id_dias LEFT JOIN usuarios u ON u.id_usuario=v.id_vendedor
      WHERE d.fecha BETWEEN ? AND ?${scope}
      GROUP BY d.id_puesto,v.id_vendedor,u.nombre,u.apellido`, [input.from, input.to, input.from, input.to, ...params]);

    // El importe se reparte por foto cuando una venta histórica vincula más de una familia.
    const [photographers] = await connection.execute(`SELECT d.id_puesto AS stationId, f.id_camarografo AS employeeId,
      'photographer' AS role, COALESCE(CONCAT(u.nombre,' ',u.apellido),'Sin camarógrafo registrado') AS name,
      COUNT(DISTINCT f.id_fotos) AS taken, COUNT(DISTINCT v.id_venta) AS sales,
      COALESCE(SUM(v.precio_total / links.photos),0) AS earnings,
      COUNT(DISTINCT CASE WHEN v.id_venta IS NOT NULL THEN f.id_fotos END) AS sold
      FROM fotos f JOIN dias d ON d.id_dias=f.id_dia LEFT JOIN usuarios u ON u.id_usuario=f.id_camarografo
      LEFT JOIN fotos_venta fv ON fv.id_foto=f.id_fotos LEFT JOIN venta v ON v.id_venta=fv.id_venta
      LEFT JOIN (SELECT id_venta,COUNT(*) AS photos FROM fotos_venta GROUP BY id_venta) links ON links.id_venta=v.id_venta
      WHERE d.fecha BETWEEN ? AND ?${scope}
      GROUP BY d.id_puesto,f.id_camarografo,u.nombre,u.apellido`, params);

    const [unattributed] = await connection.execute(`SELECT d.id_puesto AS stationId,NULL AS employeeId,
      'photographer' AS role,'Sin camarógrafo registrado' AS name,
      SUM(GREATEST(d.fotos-(SELECT COUNT(*) FROM fotos f WHERE f.id_dia=d.id_dias),0)) AS taken,
      COALESCE(SUM(v.sales),0) AS sales,COALESCE(SUM(v.earnings),0) AS earnings,COALESCE(SUM(v.sold),0) AS sold
      FROM dias d LEFT JOIN (SELECT v.id_dias,COUNT(*) AS sales,SUM(v.precio_total) AS earnings,
        SUM(IF(v.familia_contada,v.cantidad,0)) AS sold FROM venta v
        WHERE NOT EXISTS(SELECT 1 FROM fotos_venta fv WHERE fv.id_venta=v.id_venta) GROUP BY v.id_dias) v ON v.id_dias=d.id_dias
      WHERE d.fecha BETWEEN ? AND ?${scope} GROUP BY d.id_puesto
      HAVING taken > 0 OR sales > 0`, params);

    // También aparecen empleados que trabajaron y no registraron producción o ventas.
    const [workers] = await connection.execute(`SELECT DISTINCT d.id_puesto AS stationId,h.id_usuario AS employeeId,
      CONCAT(u.nombre,' ',u.apellido) AS name,
      CASE r.nombre WHEN 'vendedor' THEN 'seller' ELSE 'photographer' END AS role,
      ${opportunities('h.id_usuario')} AS opportunityTaken,${missingTimes} AS missingTimes
      FROM horarios h JOIN dias d ON d.id_dias=h.id_dias JOIN usuarios u ON u.id_usuario=h.id_usuario
      JOIN rol r ON r.id_rol=u.id_rol WHERE d.fecha BETWEEN ? AND ?${scope}
      AND r.nombre IN ('vendedor','camarografo')`, [input.from, input.to, input.from, input.to, ...params]);
    let hours = [], attendance = [];
    if (input.day) {
      const dayParams = [input.day, ...(station ? [station] : [])];
      [hours] = await connection.execute(`SELECT stationId,hour,SUM(sales) AS sales,SUM(earnings) AS earnings,
        SUM(sold) AS sold,SUM(taken) AS taken FROM (
        SELECT d.id_puesto AS stationId,${hour('v.created_at')} AS hour,COUNT(*) AS sales,
          SUM(v.precio_total) AS earnings,SUM(IF(v.familia_contada,v.cantidad,0)) AS sold,0 AS taken
          FROM venta v JOIN dias d ON d.id_dias=v.id_dias WHERE d.fecha=?${scope}
          GROUP BY d.id_puesto,hour
        UNION ALL
        SELECT d.id_puesto,${hour('f.created_at')} AS hour,0,0,0,COUNT(*)
          FROM fotos f JOIN dias d ON d.id_dias=f.id_dia WHERE d.fecha=?${scope}
          GROUP BY d.id_puesto,hour
        UNION ALL
        SELECT d.id_puesto,NULL,0,0,0,GREATEST(d.fotos-COUNT(f.id_fotos),0)
          FROM dias d LEFT JOIN fotos f ON f.id_dia=d.id_dias WHERE d.fecha=?${scope}
          GROUP BY d.id_dias,d.id_puesto,d.fotos
        ) events GROUP BY stationId,hour ORDER BY hour`, [...dayParams, ...dayParams, ...dayParams]);
      // Se consulta por solapamiento real, incluyendo turnos iniciados el día anterior.
      [attendance] = await connection.execute(`SELECT h.id_horario AS id,h.id_usuario AS employeeId,d.id_puesto AS stationId,
        CONCAT(u.nombre,' ',u.apellido) AS name,r.nombre AS role,h.check_in AS checkIn,h.check_out AS checkOut
        FROM horarios h JOIN dias d ON d.id_dias=h.id_dias JOIN usuarios u ON u.id_usuario=h.id_usuario
        JOIN rol r ON r.id_rol=u.id_rol WHERE h.check_in < DATE_ADD(CONCAT(?,' 03:00:00'),INTERVAL 1 DAY)
        AND (h.check_out IS NULL OR h.check_out > CONCAT(?,' 03:00:00'))${scope}
        ORDER BY d.id_puesto,h.check_in`, [input.day, input.day, ...(station ? [station] : [])]);
    }
    return { days, hours, people: [...sellers, ...photographers, ...unattributed], workers, attendance };
    });
  },
};
