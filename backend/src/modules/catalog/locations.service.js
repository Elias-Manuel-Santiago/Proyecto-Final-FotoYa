import { ApiError } from '../../shared/errors.js';
import { managed } from './stations.service.js';

const exists = async (connection, table, key, value) => {
  const [[row]] = await connection.execute(`SELECT ${key} FROM ${table} WHERE ${key} = ? FOR UPDATE`, [value]);
  if (!row) throw new ApiError(404, 'La asociación seleccionada no existe.');
};
const uniqueName = async (connection, table, key, input) => {
  const [[row]] = await connection.execute(`SELECT ${key} FROM ${table} WHERE nombre = ? AND ${key} <> ? LIMIT 1`, [input.name, input.id ?? '0']);
  if (row) throw new ApiError(409, 'Ya existe un registro con ese nombre.');
};
const moveEvent = async (connection, eventId, cityId) => {
  await exists(connection, 'ciudad', 'id_ciudad', cityId);
  await exists(connection, 'evento', 'id_evento', eventId);
  // The composite foreign key cascades the city to every associated station.
  await connection.execute('UPDATE evento SET id_ciudad = ? WHERE id_evento = ?', [cityId, eventId]);
};
const attachStations = async (connection, eventId, cityId, stationIds) => {
  for (const stationId of stationIds) {
    await exists(connection, 'puesto', 'id_puesto', stationId);
    await connection.execute('UPDATE puesto SET id_evento = ?, id_ciudad = ? WHERE id_puesto = ?', [eventId, cityId, stationId]);
  }
};

export const locations = {
  saveCity(actor, input) {
    return managed(actor, async connection => {
      await uniqueName(connection, 'ciudad', 'id_ciudad', input);
      let cityId = input.id;
      if (cityId) {
        await exists(connection, 'ciudad', 'id_ciudad', cityId);
        await connection.execute('UPDATE ciudad SET nombre = ? WHERE id_ciudad = ?', [input.name, cityId]);
      } else {
        const [created] = await connection.execute('INSERT INTO ciudad (nombre) VALUES (?)', [input.name]);
        cityId = String(created.insertId);
      }
      for (const move of input.eventCities ?? []) await moveEvent(connection, move.eventId, move.cityId ?? cityId);
      return { id: cityId };
    });
  },
  saveEvent(actor, input) {
    return managed(actor, async connection => {
      await exists(connection, 'ciudad', 'id_ciudad', input.cityId);
      await uniqueName(connection, 'evento', 'id_evento', input);
      let eventId = input.id;
      if (eventId) {
        await exists(connection, 'evento', 'id_evento', eventId);
        await connection.execute('UPDATE evento SET nombre = ?, direccion = ? WHERE id_evento = ?', [input.name, input.directions, eventId]);
        await moveEvent(connection, eventId, input.cityId);
        const [current] = await connection.execute('SELECT id_puesto AS id FROM puesto WHERE id_evento = ? FOR UPDATE', [eventId]);
        for (const row of current) if (!input.stationIds.includes(String(row.id)))
          await connection.execute('UPDATE puesto SET id_evento = NULL WHERE id_puesto = ?', [row.id]);
      } else {
        const [created] = await connection.execute('INSERT INTO evento (nombre, direccion, id_ciudad) VALUES (?, ?, ?)', [input.name, input.directions, input.cityId]);
        eventId = String(created.insertId);
      }
      await attachStations(connection, eventId, input.cityId, input.stationIds);
      return { id: eventId };
    });
  },
  delete(actor, { kind, id }) {
    return managed(actor, async connection => {
      const [table, key] = kind === 'city' ? ['ciudad', 'id_ciudad'] : ['evento', 'id_evento'];
      await exists(connection, table, key, id);
      if (kind === 'city') {
        const [[event]] = await connection.execute('SELECT id_evento FROM evento WHERE id_ciudad = ? LIMIT 1', [id]);
        if (event) throw new ApiError(409, 'No podés eliminar una ciudad con eventos asociados.');
      }
      const [[station]] = await connection.execute(`SELECT id_puesto FROM puesto WHERE ${key} = ? LIMIT 1`, [id]);
      if (station) throw new ApiError(409, 'No podés eliminar este registro con puestos asociados, incluidos los inactivos.');
      await connection.execute(`DELETE FROM ${table} WHERE ${key} = ?`, [id]);
      return { id };
    });
  },
  updateStation(actor, input) {
    return managed(actor, async connection => {
      await exists(connection, 'puesto', 'id_puesto', input.stationId);
      let cityId = input.cityId;
      if (input.eventId) {
        await exists(connection, 'evento', 'id_evento', input.eventId);
        const [[event]] = await connection.execute('SELECT id_ciudad AS cityId FROM evento WHERE id_evento = ?', [input.eventId]);
        cityId = String(event.cityId);
      }
      await exists(connection, 'ciudad', 'id_ciudad', cityId);
      await connection.execute('UPDATE puesto SET nombre = ?, id_ciudad = ?, id_evento = ? WHERE id_puesto = ?',
        [input.name, cityId, input.eventId, input.stationId]);
      for (const assignment of input.employeeStations) {
        const [[employee]] = await connection.execute(`SELECT u.id_puesto AS stationId, r.nombre AS role FROM usuarios u JOIN rol r ON r.id_rol = u.id_rol WHERE u.id_usuario = ? FOR UPDATE`, [assignment.employeeId]);
        if (!employee || !['encargado', 'editor', 'camarografo', 'vendedor'].includes(employee.role)) throw new ApiError(422, 'Seleccioná un empleado de puesto.');
        if (assignment.stationId !== input.stationId && String(employee.stationId) !== input.stationId) throw new ApiError(422, 'Solo podés trasladar empleados desde o hacia este puesto.');
        const [[destination]] = await connection.execute('SELECT disponible AS active FROM puesto WHERE id_puesto = ? FOR UPDATE', [assignment.stationId]);
        if (!destination || (!destination.active && String(employee.stationId) !== assignment.stationId)) throw new ApiError(422, 'Seleccioná un puesto activo para trasladar empleados.');
        if (String(employee.stationId) === assignment.stationId) continue;
        const [[open]] = await connection.execute('SELECT id_horario FROM horarios WHERE id_usuario = ? AND check_out IS NULL AND closed_at IS NULL LIMIT 1', [assignment.employeeId]);
        if (open) throw new ApiError(409, 'El empleado debe cerrar su jornada antes de cambiar de puesto.');
        await connection.execute('UPDATE usuarios SET id_puesto = ? WHERE id_usuario = ?', [assignment.stationId, assignment.employeeId]);
        await connection.execute('UPDATE sesiones_usuario SET revoked_at = UTC_TIMESTAMP(6) WHERE id_usuario = ? AND revoked_at IS NULL', [assignment.employeeId]);
      }
      return { id: input.stationId };
    });
  },
};
