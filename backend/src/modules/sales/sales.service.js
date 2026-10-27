/**
 * @file
 * Coordina evento, fotos vendibles y registro idempotente de ventas. Serializa por evento,
 * conserva importes y cuenta una familia en su primera compra.
 */
import { db } from '../../config/database.js';
import { transaction } from '../../shared/transaction.js';
import { ApiError } from '../../shared/errors.js';
import { stationScope } from '../../security/access.js';
import { requirePhotoOperator } from '../photos/photos.authorization.js';
import { photoService } from '../photos/photos.service.js';
import { saleAmounts } from './sales.schemas.js';
import { businessDate, currentEvent } from './sales.rules.js';
import { salesRepository } from './sales.repository.js';
import { eventCache } from './sales.events.js';

// Revalida en la transacción el permiso de venta y la asignación del operador.
const operator = (connection, actor, stationId) => requirePhotoOperator(connection, actor, 'sales.create', stationId);

export const salesService = {
  // Comprueba que la foto pertenezca a la venta autorizada antes de pedir su previsualización.
  async accessSoldPhoto(actor, input) {
    const sale = await salesRepository.detail(actor, input.saleId);
    if (!sale.photos.some(photo => String(photo.photoId) === input.photoId))
      throw new ApiError(404, 'La foto no pertenece a esta venta.');
    return photoService.access(actor, input.photoId);
  },
  // Consulta la apertura en memoria del proceso.
  async event(actor, input) {
    stationScope(actor, input.stationId);
    const row = eventCache.get(input.stationId);
    return { open: currentEvent(row), date: row?.date ?? null };
  },
  // Lista fotos del evento vigente con destinatario e indicador de ventas anteriores.
  async photos(actor, input) {
    stationScope(actor, input.stationId);
    const current = eventCache.get(input.stationId);
    if (!currentEvent(current)) return [];
    const [rows] = await db.execute(`SELECT f.id_fotos AS id, d.fecha AS date, f.id_cliente AS clientId,
      COALESCE(f.email_cliente, (SELECT email FROM usuarios WHERE id_usuario = f.id_cliente)) AS clientEmail,
      EXISTS(SELECT 1 FROM fotos_venta fv WHERE fv.id_foto=f.id_fotos) AS sold
      FROM fotos f JOIN dias d ON d.id_dias=f.id_dia WHERE f.id_puesto=? AND f.id_dia=? AND f.oculta = ${input.hidden ? 1 : 0} ${input.photoId ? 'AND f.id_fotos=?' : ''}
      ORDER BY f.id_fotos DESC LIMIT ? OFFSET ?`, [input.stationId, current.dayId, ...(input.photoId ? [input.photoId] : []), String(input.limit), String(input.offset)]);
    // EXISTS puede llegar como "0"/"1" con bigNumberStrings; exponer un booleano real.
    return rows.map(row => ({ ...row, sold: Number(row.sold) === 1 }));
  },
  // Exige foto autorizada del día y evento abierto antes de emitir acceso temporal.
  async accessPhoto(actor, photoId) {
    const photo = await photoService.detail(actor, photoId);
    const current = eventCache.get(photo.stationId);
    if (photo.date !== businessDate() || !currentEvent(current)) throw new ApiError(404, 'La foto no está disponible para esta venta.');
    return photoService.access(actor, photoId);
  },
  // Valida el reintento y registra venta, tarifas, foto e indicadores como una unidad indivisible.
  create(actor, input) {
    stationScope(actor, input.stationId);
    // Ordenar tarifas hace equivalentes los reintentos que solo cambian el orden de las líneas.
    const requestData = JSON.stringify({ ...input, prices: [...input.prices].sort((a, b) => a.priceId.localeCompare(b.priceId)) });
    return eventCache.run(input.stationId, () => transaction(async connection => {
      await operator(connection, actor, input.stationId);
      const [[station]] = await connection.execute('SELECT disponible AS active FROM puesto WHERE id_puesto=? FOR UPDATE', [input.stationId]);
      const current = eventCache.get(input.stationId);
      const [[existing]] = await connection.execute('SELECT id_venta AS id, request_data, id_vendedor FROM venta WHERE operation_id=? FOR UPDATE', [input.operationId]);
      // Se reconoce el UUID ya confirmado antes de exigir que el evento siga abierto.
      if (existing) {
        if (existing.request_data !== requestData || String(existing.id_vendedor) !== actor.id)
          throw new ApiError(409, 'La operación ya se usó con otros datos.', 'IDEMPOTENCY_CONFLICT');
        return { id: String(existing.id), repeated: true };
      }
      if (!station?.active || !currentEvent(current)) throw new ApiError(409, 'Las ventas del evento están cerradas.', 'EVENT_CLOSED');
      const [[day]] = await connection.execute('SELECT fotos FROM dias WHERE id_dias=? FOR UPDATE', [current.dayId]);
      const [[photo]] = await connection.execute('SELECT id_fotos FROM fotos WHERE id_fotos=? AND id_dia=? AND id_puesto=? FOR UPDATE', [input.photoId, current.dayId, input.stationId]);
      if (!photo) throw new ApiError(422, 'La foto no pertenece al evento abierto de este puesto.');
      const [prices] = await connection.execute('SELECT id_precios AS id, monto AS amount FROM precios WHERE id_puesto=? AND disponible=1 ORDER BY id_precios LOCK IN SHARE MODE', [input.stationId]);
      if (!prices.length) throw new ApiError(409, 'No hay precios disponibles para vender en este puesto.', 'NO_PRICES');
      const amounts = saleAmounts(prices, input.prices);
      if (amounts.applied.some(line => !line)) throw new ApiError(422, 'Una tarifa no está disponible en este puesto.', 'INVALID_PRICE');
      const [[previous]] = await connection.execute('SELECT id_venta FROM fotos_venta WHERE id_foto=? LIMIT 1 FOR UPDATE', [input.photoId]);
      // Una segunda compra de la misma foto agrega ingreso y copias, sin contar otra familia.
      const counted = !previous;
      const [[totals]] = await connection.execute('SELECT COALESCE(SUM(IF(familia_contada,cantidad,0)),0) AS sold FROM venta WHERE id_dias=? FOR UPDATE', [current.dayId]);
      const discarded = Number(day.fotos) - Number(totals.sold) - Number(counted);
      if (discarded < 0) throw new ApiError(409, 'Los conteos del evento requieren revisión.');
      const [sale] = await connection.execute(`INSERT INTO venta
        (cantidad,precio_total,id_dias,operation_id,request_data,id_vendedor,metodo_pago,copias,familia_contada,created_at)
        VALUES (1,?,?,?,?,?,?,?,?,UTC_TIMESTAMP(6))`,
      [amounts.total, current.dayId, input.operationId, requestData, actor.id, input.paymentMethod, amounts.copies, counted]);
      await connection.execute('INSERT INTO fotos_venta (id_foto,id_venta) VALUES (?,?)', [input.photoId, sale.insertId]);
      // Cada línea conserva el precio unitario aplicado aunque la tarifa cambie en el futuro.
      for (const line of amounts.applied) await connection.execute(`INSERT INTO precios_venta
        (id_venta,id_precio,precio_unitario_aplicado,cantidad) VALUES (?,?,?,?)`, [sale.insertId, line.priceId, line.unitPrice, line.copies]);
      await connection.execute('UPDATE dias SET descartes=?, venta_total=venta_total+? WHERE id_dias=?', [discarded, amounts.total, current.dayId]);
      return { id: String(sale.insertId), total: amounts.total, copies: amounts.copies, counted };
    }));
  },
};
