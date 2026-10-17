import { db } from '../../config/database.js';
import { globalScope, stationScope } from '../../security/access.js';

const columns = `u.id_usuario AS id, u.nombre, u.apellido, u.email, u.dni, u.id_rol AS roleId,
r.nombre AS role, u.id_puesto AS stationId, u.disponible AS active, u.created_at, u.updated_at`;
export const userRepository = {
  async find(userId, executor = db) {
    const [[row]] = await executor.execute(`SELECT ${columns} FROM usuarios u JOIN rol r ON r.id_rol = u.id_rol WHERE u.id_usuario = ?`, [userId]);
    return row;
  },
  async query(actor, input) {
    const station = stationScope(actor, input.stationId), where = [], params = [];
    if (station) { where.push('u.id_puesto = ?'); params.push(station); }
    if (actor.role === 'secretario') where.push("r.nombre <> 'cliente'");
    for (const [name, column] of [['email', 'email'], ['dni', 'dni'], ['active', 'disponible']]) {
      if (input[name] !== undefined) { where.push(`u.${column} = ?`); params.push(input[name]); }
    }
    const [rows] = await db.execute(`SELECT ${columns} FROM usuarios u JOIN rol r ON r.id_rol = u.id_rol
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY u.id_usuario LIMIT ? OFFSET ?`, [...params, String(input.limit), String(input.offset)]);
    return rows;
  },
  async role(roleId, executor = db) {
    const [[row]] = await executor.execute('SELECT nombre FROM rol WHERE id_rol = ?', [roleId]);
    return row?.nombre;
  },
  canRead(actor, row) {
    return row && (globalScope(actor) ? actor.role !== 'secretario' || row.role !== 'cliente' : actor.stationId && actor.stationId === row.stationId);
  },
};
