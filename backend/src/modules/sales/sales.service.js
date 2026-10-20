import { db } from '../../config/database.js';
import { transaction } from '../../shared/transaction.js';
import { ApiError } from '../../shared/errors.js';
import { stationScope, assertPermission } from '../../security/access.js';
import { requirePhotoOperator } from '../photos/photos.authorization.js';
import { photoService } from '../photos/photos.service.js';
import { saleAmounts } from './sales.schemas.js';
import { businessDate, currentEvent } from './sales.rules.js';
import { salesRepository } from './sales.repository.js';

const columns = 'e.abierta AS open, d.fecha AS date';
const event = async (executor, stationId, lock = false) => {
  const [[row]] = await executor.execute(`SELECT ${columns}, e.id_dia AS dayId FROM event_sales e
    JOIN dias d ON d.id_dias = e.id_dia WHERE e.id_puesto = ? ${lock ? 'FOR UPDATE' : ''}`, [stationId]);
  return row;
};
const operator = (connection, actor, stationId) => requirePhotoOperator(connection, actor, 'sales.create', stationId);

export const salesService = {
  async accessSoldPhoto(actor, input) {
    const sale = await salesRepository.detail(actor, input.saleId);
    if (!sale.photos.some(photo => String(photo.photoId) === input.photoId))
      throw new ApiError(404, 'La foto no pertenece a esta venta.');
    return photoService.access(actor, input.photoId);
  },
  async event(actor, input) {
    stationScope(actor, input.stationId);
    const row = await event(db, input.stationId);
    return { open: currentEvent(row), date: row?.date ?? null };
  },
  setEvent(actor, input) {
    assertPermission(actor, 'sales.create');
    if (actor.role !== 'encargado') throw new ApiError(403, 'Solo el encargado puede abrir o cerrar las ventas del evento.');
    return transaction(async connection => {
      const authorized = await operator(connection, actor, input.stationId);
      if (authorized.role !== 'encargado') throw new ApiError(403, 'Solo el encargado puede abrir o cerrar ventas.');
      const [[station]] = await connection.execute('SELECT disponible AS active FROM puesto WHERE id_puesto = ? FOR UPDATE', [input.stationId]);
      if (!station || (input.open && !station.active)) throw new ApiError(409, 'El puesto no está disponible.');
      const current = await event(connection, input.stationId, true);
      if (input.open && !currentEvent(current)) {
        const date = businessDate();
        await connection.execute('INSERT INTO dias (fecha,id_puesto) VALUES (?,?) ON DUPLICATE KEY UPDATE id_dias=id_dias', [date, input.stationId]);
        const [[day]] = await connection.execute('SELECT id_dias AS id FROM dias WHERE fecha=? AND id_puesto=? FOR UPDATE', [date, input.stationId]);
        await connection.execute(`INSERT INTO event_sales (id_puesto,id_dia,abierta) VALUES (?,?,1)
          ON DUPLICATE KEY UPDATE id_dia=VALUES(id_dia), abierta=1, updated_at=UTC_TIMESTAMP(6)`, [input.stationId, day.id]);
      } else if (!input.open && current) {
        await connection.execute('UPDATE event_sales SET abierta=0, updated_at=UTC_TIMESTAMP(6) WHERE id_puesto=?', [input.stationId]);
      }
      const row = await event(connection, input.stationId);
      return { open: currentEvent(row), date: row?.date ?? null };
    });
  },
  async photos(actor, input) {
    stationScope(actor, input.stationId);
    const current = await event(db, input.stationId);
    if (!currentEvent(current)) return [];
    const [rows] = await db.execute(`SELECT f.id_fotos AS id, d.fecha AS date, f.id_cliente AS clientId,
      COALESCE(f.email_cliente, (SELECT email FROM usuarios WHERE id_usuario = f.id_cliente)) AS clientEmail,
      EXISTS(SELECT 1 FROM fotos_venta fv WHERE fv.id_foto=f.id_fotos) AS sold
      FROM fotos f JOIN dias d ON d.id_dias=f.id_dia WHERE f.id_puesto=? AND f.id_dia=? ${input.photoId ? 'AND f.id_fotos=?' : ''}
      ORDER BY f.id_fotos DESC LIMIT ? OFFSET ?`, [input.stationId, current.dayId, ...(input.photoId ? [input.photoId] : []), String(input.limit), String(input.offset)]);
    return rows;
  },
  async accessPhoto(actor, photoId) {
    const photo = await photoService.detail(actor, photoId);
    const current = await event(db, photo.stationId);
    if (photo.date !== businessDate() || !currentEvent(current)) throw new ApiError(404, 'La foto no está disponible para esta venta.');
    return photoService.access(actor, photoId);
  },
  create(actor, input) {
    stationScope(actor, input.stationId);
    const requestData = JSON.stringify({ ...input, prices: [...input.prices].sort((a, b) => a.priceId.localeCompare(b.priceId)) });
    return transaction(async connection => {
      await operator(connection, actor, input.stationId);
      const [[station]] = await connection.execute('SELECT disponible AS active FROM puesto WHERE id_puesto=? LOCK IN SHARE MODE', [input.stationId]);
      // El bloqueo del evento serializa las ventas del puesto, incluidas las de una misma familia.
      const current = await event(connection, input.stationId, true);
      const [[existing]] = await connection.execute('SELECT id_venta AS id, request_data, id_vendedor FROM venta WHERE operation_id=? FOR UPDATE', [input.operationId]);
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
      const counted = !previous;
      const [[totals]] = await connection.execute('SELECT COALESCE(SUM(IF(familia_contada,cantidad,0)),0) AS sold FROM venta WHERE id_dias=? FOR UPDATE', [current.dayId]);
      const discarded = Number(day.fotos) - Number(totals.sold) - Number(counted);
      if (discarded < 0) throw new ApiError(409, 'Los conteos del evento requieren revisión.');
      const [sale] = await connection.execute(`INSERT INTO venta
        (cantidad,precio_total,id_dias,operation_id,request_data,id_vendedor,metodo_pago,copias,familia_contada,created_at)
        VALUES (1,?,?,?,?,?,?,?,?,UTC_TIMESTAMP(6))`,
      [amounts.total, current.dayId, input.operationId, requestData, actor.id, input.paymentMethod, amounts.copies, counted]);
      await connection.execute('INSERT INTO fotos_venta (id_foto,id_venta) VALUES (?,?)', [input.photoId, sale.insertId]);
      for (const line of amounts.applied) await connection.execute(`INSERT INTO precios_venta
        (id_venta,id_precio,precio_unitario_aplicado,cantidad) VALUES (?,?,?,?)`, [sale.insertId, line.priceId, line.unitPrice, line.copies]);
      await connection.execute('UPDATE dias SET descartes=?, venta_total=venta_total+? WHERE id_dias=?', [discarded, amounts.total, current.dayId]);
      return { id: String(sale.insertId), total: amounts.total, copies: amounts.copies, counted };
    });
  },
};
