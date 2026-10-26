/**
 * @file
 * Consulta puestos, ciudades, eventos, roles y tarifas según recurso/actor. Conserva puestos
 * inactivos para el historial y restringe tarifas por puesto.
 */
import { db } from '../../config/database.js';
import { globalScope, stationScope } from '../../security/access.js';
import { ApiError } from '../../shared/errors.js';

export const catalogRepository = {
  // Resuelve el catálogo solicitado aplicando alcance y restricciones de roles o tarifas.
  async query(actor, input) {
    if (input.resource === 'stations') {
      const station = stationScope(actor, input.stationId);
      const [rows] = await db.execute(`SELECT p.id_puesto AS id, p.nombre AS name, p.direccion AS address,
        c.id_ciudad AS cityId, c.nombre AS city, e.id_evento AS eventId, e.nombre AS event, p.disponible AS active
        FROM puesto p JOIN ciudad c ON c.id_ciudad = p.id_ciudad LEFT JOIN evento e ON e.id_evento = p.id_evento
        ${station ? 'WHERE p.id_puesto = ?' : ''} ORDER BY p.id_puesto LIMIT ? OFFSET ?`,
      [...(station ? [station] : []), String(input.limit), String(input.offset)]);
      return rows;
    }
    if (input.resource === 'roles') {
      if (!actor.permissions.includes('employees.read')) throw new ApiError(403, 'No tenés permiso para consultar roles.');
      const [rows] = await db.execute(`SELECT id_rol AS id, nombre AS name FROM rol
        ${globalScope(actor) ? "WHERE nombre <> 'checkin'" : "WHERE nombre IN ('encargado', 'editor', 'camarografo', 'vendedor')"} ORDER BY id_rol`);
      return rows;
    }
    if (['cities', 'events'].includes(input.resource)) {
      const station = stationScope(actor, input.stationId);
      const [table, key] = input.resource === 'cities' ? ['ciudad', 'id_ciudad'] : ['evento', 'id_evento'];
      const [rows] = await db.execute(`SELECT DISTINCT c.${key} AS id, c.nombre AS name ${input.resource === 'events' ? ', c.id_ciudad AS cityId' : ''} FROM ${table} c
        ${station ? `JOIN puesto p ON p.${key} = c.${key} WHERE p.id_puesto = ?` : ''}
        ORDER BY c.${key} LIMIT ? OFFSET ?`, [...(station ? [station] : []), String(input.limit), String(input.offset)]);
      return rows;
    }
    const station = stationScope(actor, input.stationId);
    const [rows] = await db.execute(`SELECT id_precios AS id, nombre AS name, monto AS amount, id_puesto AS stationId
      FROM precios WHERE disponible = 1 AND id_puesto IS NOT NULL ${station ? 'AND id_puesto = ?' : ''}
      ORDER BY id_precios LIMIT ? OFFSET ?`, [...(station ? [station] : []), String(input.limit), String(input.offset)]);
    return rows;
  },
};
