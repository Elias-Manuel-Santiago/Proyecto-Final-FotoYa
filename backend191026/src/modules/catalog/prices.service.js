import { db } from '../../config/database.js';
import { ApiError } from '../../shared/errors.js';
import { transaction } from '../../shared/transaction.js';
import { assertPermission, stationScope } from '../../security/access.js';
import { requirePhotoOperator } from '../photos/photos.authorization.js';

const managed = (actor, input, callback) => {
  assertPermission(actor, 'prices.manage');
  stationScope(actor, input.stationId);
  return transaction(async connection => {
    await connection.query('SELECT id_rol FROM rol ORDER BY id_rol FOR UPDATE');
    const current = await requirePhotoOperator(connection, actor, 'prices.manage', input.stationId);
    if (!['dueno', 'encargado'].includes(current.role)) throw new ApiError(403, 'No tenés permiso para administrar precios.');
    const [[station]] = await connection.execute('SELECT disponible AS active FROM puesto WHERE id_puesto=? FOR UPDATE', [input.stationId]);
    if (!station?.active) throw new ApiError(422, 'El puesto no está disponible.');
    return callback(connection);
  });
};
const target = async (connection, input) => {
  const [[row]] = await connection.execute('SELECT id_precios FROM precios WHERE id_precios=? AND id_puesto=? FOR UPDATE', [input.priceId, input.stationId]);
  if (!row) throw new ApiError(404, 'El precio no existe.');
};
export const pricesService = {
  async query(actor, input) {
    stationScope(actor, input.stationId);
    const [rows] = await db.execute(`SELECT id_precios AS id, nombre AS name, monto AS amount, id_puesto AS stationId, disponible AS active
      FROM precios WHERE id_puesto=? ORDER BY id_precios LIMIT ? OFFSET ?`, [input.stationId, String(input.limit), String(input.offset)]);
    return rows;
  },
  create(actor, input) {
    return managed(actor, input, async connection => {
      const [result] = await connection.execute('INSERT INTO precios (nombre,monto,id_puesto) VALUES (?,?,?)', [input.name, input.amount, input.stationId]);
      return { id: String(result.insertId) };
    });
  },
  update(actor, input) {
    return managed(actor, input, async connection => {
      await target(connection, input);
      await connection.execute('UPDATE precios SET nombre=?, monto=? WHERE id_precios=? AND id_puesto=?', [input.name, input.amount, input.priceId, input.stationId]);
      return { id: input.priceId };
    });
  },
  setActive(actor, input) {
    return managed(actor, input, async connection => {
      await target(connection, input);
      await connection.execute('UPDATE precios SET disponible=? WHERE id_precios=? AND id_puesto=?', [input.active, input.priceId, input.stationId]);
      return { id: input.priceId, active: input.active };
    });
  },
};
