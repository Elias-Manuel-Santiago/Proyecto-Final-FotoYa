/**
 * @file
 * Consulta usuarios y roles dentro del alcance del actor. Permite reutilizar búsquedas desde
 * una conexión transaccional.
 */
import { db } from '../../config/database.js';
import { globalScope, stationScope } from '../../security/access.js';

const columns = `u.id_usuario AS id, u.nombre, u.apellido, u.email, u.dni, u.auth0_sub, u.id_rol AS roleId,
r.nombre AS role, u.id_puesto AS stationId, u.disponible AS active, u.created_at, u.updated_at`;
export const userRepository = {
  // Busca usuario con rol y puesto usando el pool o la conexión recibida.
  async find(userId, executor = db) {
    const [[row]] = await executor.execute(`SELECT ${columns},
      (SELECT nombre FROM puesto WHERE id_puesto = u.id_puesto) AS stationName
      FROM usuarios u JOIN rol r ON r.id_rol = u.id_rol WHERE u.id_usuario = ?`, [userId]);
    return row;
  },
  // Aplica filtros y alcance a la lista paginada de usuarios.
  async query(actor, input) {
    const station = stationScope(actor, input.stationId), where = ["r.nombre <> 'checkin'"], params = [];
    if (station) { where.push('u.id_puesto = ?'); params.push(station); }
    if (actor.role === 'secretario') where.push("r.nombre NOT IN ('cliente','dueno')");
    for (const [name, column] of [['email', 'email'], ['dni', 'dni'], ['active', 'disponible']]) {
      if (input[name] !== undefined) { where.push(`u.${column} = ?`); params.push(input[name]); }
    }
    const [rows] = await db.execute(`SELECT ${columns} FROM usuarios u JOIN rol r ON r.id_rol = u.id_rol
      ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY u.id_usuario LIMIT ? OFFSET ?`, [...params, String(input.limit), String(input.offset)]);
    return rows;
  },
  // Resuelve el nombre del rol por su identificador persistido.
  async role(roleId, executor = db) {
    const [[row]] = await executor.execute('SELECT nombre FROM rol WHERE id_rol = ?', [roleId]);
    return row?.nombre;
  },
  // Evalúa visibilidad según rol global o coincidencia de puesto.
  canRead(actor, row) {
    return row && row.role !== 'checkin' && (globalScope(actor) ? actor.role !== 'secretario' || !['cliente', 'dueno'].includes(row.role) : actor.stationId && actor.stationId === row.stationId);
  },
};
