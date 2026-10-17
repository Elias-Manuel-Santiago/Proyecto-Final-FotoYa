import { db } from '../../config/database.js';
import { stationScope } from '../../security/access.js';
import { ApiError } from '../../shared/errors.js';

export const salesRepository = {
  async query(actor, input) {
    const station = stationScope(actor, input.stationId);
    const [rows] = await db.execute(`SELECT v.id_venta AS id, v.id_dias AS dayId, d.fecha AS date, d.id_puesto AS stationId,
      IF(v.familia_contada,v.cantidad,0) AS quantity, v.precio_total AS total,
      v.copias AS copies, v.metodo_pago AS paymentMethod, v.created_at AS createdAt FROM venta v JOIN dias d ON d.id_dias = v.id_dias
      WHERE d.fecha BETWEEN ? AND ? ${station ? 'AND d.id_puesto = ?' : ''}
      ORDER BY d.fecha DESC, v.id_venta DESC LIMIT ? OFFSET ?`,
    [input.from, input.to, ...(station ? [station] : []), String(input.limit), String(input.offset)]);
    return rows;
  },
  async detail(actor, saleId) {
    const station = stationScope(actor);
    const [[sale]] = await db.execute(`SELECT v.id_venta AS id, IF(v.familia_contada,v.cantidad,0) AS quantity, v.precio_total AS total,
      v.copias AS copies, v.metodo_pago AS paymentMethod,
      d.fecha AS date, d.id_puesto AS stationId FROM venta v JOIN dias d ON d.id_dias = v.id_dias
      WHERE v.id_venta = ? ${station ? 'AND d.id_puesto = ?' : ''}`, [saleId, ...(station ? [station] : [])]);
    if (!sale) throw new ApiError(404, 'La venta no existe.');
    const [prices] = await db.execute(`SELECT id_precio AS priceId, precio_unitario_aplicado AS unitPrice, cantidad AS quantity
      FROM precios_venta WHERE id_venta = ? ORDER BY id_precio_venta`, [saleId]);
    const [photos] = await db.execute('SELECT id_foto AS photoId FROM fotos_venta WHERE id_venta = ? ORDER BY id_foto', [saleId]);
    return { ...sale, prices, photos };
  },
};
