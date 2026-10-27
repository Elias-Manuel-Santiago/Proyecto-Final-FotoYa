/**
 * @file
 * Bloquea una sesión del encargado en Check-in y registra entradas/salidas.
 * Revalida credenciales, puesto y horario esperado bajo bloqueo.
 */
import { db } from '../../config/database.js';
import { transaction } from '../../shared/transaction.js';
import { ApiError } from '../../shared/errors.js';
import { hashPassword, verifyPassword, normalizeEmail, newToken } from '../../security/crypto.js';
import { businessDate, currentEvent } from '../sales/sales.rules.js';
import { eventCache } from '../sales/sales.events.js';

const dummyHash = await hashPassword(newToken());
// Las marcaciones dependen del cierre manual, no del cambio de día de ventas.
const eventStatus = row => ({ open: currentEvent(row), attendanceOpen: Boolean(row?.open), date: row?.date ?? null });
// El modo pertenece a la sesión, nunca a la cuenta completa.
export function requireCheckIn(actor) {
  if (actor.role !== 'encargado' || !actor.kioskMode)
    throw new ApiError(403, 'Activá Check-in desde la cuenta del encargado.', 'FORBIDDEN');
}
// Exige un puesto antes de consultar o registrar asistencia.
const requireKiosk = actor => {
  requireCheckIn(actor);
  if (!actor.stationId) throw new ApiError(409, 'El encargado necesita un puesto asignado.', 'STATION_REQUIRED');
};
// Mismo orden de bloqueo que la gestión de usuarios para serializar bajas y reasignaciones.
// Bloquea y revalida cuenta y sesión antes de modificar kiosco o asistencia.
const managed = (actor, callback) => transaction(async connection => {
  if (actor.role !== 'encargado') throw new ApiError(403, 'Solo el encargado puede activar Check-in.', 'FORBIDDEN');
  await connection.query('SELECT id_rol FROM rol ORDER BY id_rol FOR UPDATE');
  const [[manager]] = await connection.execute(`SELECT u.password, u.disponible, u.id_puesto AS stationId, r.nombre AS role
    FROM usuarios u JOIN rol r ON r.id_rol = u.id_rol WHERE u.id_usuario = ? FOR UPDATE`, [actor.id]);
  const [[session]] = await connection.execute(`SELECT check_in_mode AS kioskMode FROM sesiones_usuario
    WHERE id_sesiones_usuario = ? AND id_usuario = ? AND revoked_at IS NULL AND expires_at > UTC_TIMESTAMP(6) FOR UPDATE`, [actor.sessionId, actor.id]);
  if (!manager?.disponible || manager.role !== 'encargado' || manager.stationId !== actor.stationId || !session ||
      Boolean(Number(session.kioskMode)) !== actor.kioskMode)
    throw new ApiError(403, 'La autorización cambió. Volvé a iniciar sesión.', 'FORBIDDEN');
  return callback(connection, manager, session);
});

export const kioskService = {
  // El bloqueo del usuario serializa dos dispositivos que intentan activarlo a la vez.
  async enter(actor) {
    return managed(actor, async (connection) => {
      if (actor.kioskMode) throw new ApiError(409, 'Esta sesión ya está en Check-in.', 'CHECK_IN_ACTIVE');
      if (!actor.stationId) throw new ApiError(409, 'El encargado necesita un puesto asignado.', 'STATION_REQUIRED');
      const [[station]] = await connection.execute('SELECT disponible FROM puesto WHERE id_puesto = ? LOCK IN SHARE MODE', [actor.stationId]);
      if (!station?.disponible) throw new ApiError(409, 'El puesto está inactivo.', 'STATION_REQUIRED');
      const [[existing]] = await connection.execute(`SELECT id_sesiones_usuario FROM sesiones_usuario
        WHERE id_usuario = ? AND check_in_mode = TRUE AND revoked_at IS NULL AND expires_at > UTC_TIMESTAMP(6)
        LIMIT 1 FOR UPDATE`, [actor.id]);
      if (existing) throw new ApiError(409, 'Check-in ya está abierto en otro dispositivo.', 'CHECK_IN_ACTIVE');
      await connection.execute('UPDATE sesiones_usuario SET check_in_mode = TRUE WHERE id_sesiones_usuario = ?', [actor.sessionId]);
      return { kioskMode: true };
    });
  },
  async exit(actor, input) {
    requireKiosk(actor);
    return managed(actor, async (connection, account) => {
      if (!await verifyPassword(input.password, account.password))
        throw new ApiError(401, 'La contraseña del encargado es incorrecta.', 'INVALID_CREDENTIALS');
      await connection.execute('UPDATE sesiones_usuario SET revoked_at = UTC_TIMESTAMP(6) WHERE id_sesiones_usuario = ?', [actor.sessionId]);
      return { revoked: true };
    });
  },
  // El puesto siempre se obtiene de la sesión autenticada.
  async event(actor) {
    requireKiosk(actor);
    const row = eventCache.get(actor.stationId);
    return eventStatus(row);
  },
  // Comparte la cola del puesto con ventas y marcaciones para ordenar el cierre.
  setEvent(actor, input) {
    requireKiosk(actor);
    const stationId = actor.stationId;
    return eventCache.run(stationId, async () => {
      const row = await managed(actor, async connection => {
        const [[station]] = await connection.execute('SELECT disponible AS active FROM puesto WHERE id_puesto = ? FOR UPDATE', [stationId]);
        if (!station || (input.open && !station.active)) throw new ApiError(409, 'El puesto no está disponible.');
        const current = eventCache.get(stationId);
        if (!input.open) {
          await connection.execute(`UPDATE horarios h JOIN dias d ON d.id_dias = h.id_dias
            SET h.closed_at = UTC_TIMESTAMP(6)
            WHERE d.id_puesto = ? AND h.check_out IS NULL AND h.closed_at IS NULL`, [stationId]);
        }
        if (input.open && !currentEvent(current)) {
          const date = businessDate();
          await connection.execute('INSERT INTO dias (fecha,id_puesto) VALUES (?,?) ON DUPLICATE KEY UPDATE id_dias=id_dias', [date, stationId]);
          const [[day]] = await connection.execute('SELECT id_dias AS id FROM dias WHERE fecha=? AND id_puesto=? FOR UPDATE', [date, stationId]);
          return { open: true, date, dayId: day.id };
        }
        return current ? { ...current, open: input.open } : undefined;
      });
      // Un rollback nunca publica una apertura o cierre que no se confirmó.
      if (row) eventCache.set(stationId, row);
      return eventStatus(row);
    });
  },
  // Lista empleados activos del puesto con su turno abierto para elegir entrada o salida.
  async employees(actor, input) {
    requireKiosk(actor);
    const [rows] = await db.execute(`SELECT u.id_usuario AS id, u.nombre AS firstName, u.apellido AS lastName,
      (SELECT h.id_horario FROM horarios h JOIN dias d ON d.id_dias = h.id_dias
        WHERE h.id_usuario = u.id_usuario AND h.check_out IS NULL AND h.closed_at IS NULL AND d.id_puesto = ?
        ORDER BY h.id_horario DESC LIMIT 1) AS attendanceId
      FROM usuarios u JOIN rol r ON r.id_rol = u.id_rol
      WHERE u.disponible = 1 AND u.id_puesto = ? AND r.nombre NOT IN ('cliente', 'dueno', 'secretario', 'checkin')
      ORDER BY u.nombre, u.apellido, u.id_usuario LIMIT ? OFFSET ?`, [actor.stationId, actor.stationId, String(input.limit), String(input.offset)]);
    return rows.map(row => ({ ...row, working: row.attendanceId !== null }));
  },
  // Verifica credenciales y turno esperado antes de registrar la entrada o salida del empleado.
  async mark(actor, input) {
    requireKiosk(actor);
    return eventCache.run(actor.stationId, () => managed(actor, async (connection) => {
      const assertAttendanceOpen = () => {
        if (!eventCache.get(actor.stationId)?.open)
          throw new ApiError(409, 'Abrí las ventas desde Check-in para registrar entradas o salidas.', 'EVENT_CLOSED');
      };
      assertAttendanceOpen();
      const [[employee]] = await connection.execute(`SELECT u.id_usuario AS id, u.email, u.password, u.disponible,
        u.id_puesto AS stationId, r.nombre AS role FROM usuarios u JOIN rol r ON r.id_rol = u.id_rol
        WHERE u.id_usuario = ? FOR UPDATE`, [input.userId]);
      const valid = await verifyPassword(input.password, employee?.password ?? dummyHash);
      if (!valid || !employee?.disponible || employee.email !== normalizeEmail(input.email) ||
        employee.stationId !== actor.stationId || ['cliente', 'dueno', 'secretario', 'checkin'].includes(employee.role))
        throw new ApiError(401, 'Ingresá el mail y la contraseña del empleado seleccionado.', 'INVALID_CREDENTIALS');
      const [open] = await connection.execute(`SELECT h.id_horario AS id, d.id_puesto AS stationId
        FROM horarios h JOIN dias d ON d.id_dias = h.id_dias
        WHERE h.id_usuario = ? AND h.check_out IS NULL AND h.closed_at IS NULL FOR UPDATE`, [input.userId]);
      const current = open.find(row => row.stationId === actor.stationId);
      // El turno recibido funciona como control de concurrencia: una lista vieja no marca dos veces.
      if ((current?.id ?? null) !== input.attendanceId || (input.action === 'check-in' ? open.length > 0 : !current))
        throw new ApiError(409, 'La asistencia cambió o hay una jornada abierta en otro puesto. Actualizá la lista.', 'ATTENDANCE_CHANGED');
      if (input.action === 'check-out') {
        await connection.execute('UPDATE horarios SET check_out = UTC_TIMESTAMP(6) WHERE id_horario = ? AND check_out IS NULL AND closed_at IS NULL', [current.id]);
        return { working: false };
      }
      const date = businessDate();
      await connection.execute('INSERT INTO dias (id_puesto, fecha) VALUES (?, ?) ON DUPLICATE KEY UPDATE id_dias = id_dias', [actor.stationId, date]);
      await connection.execute(`INSERT INTO horarios (id_usuario, id_dias, check_in)
        SELECT ?, id_dias, UTC_TIMESTAMP(6) FROM dias WHERE id_puesto = ? AND fecha = ?`, [input.userId, actor.stationId, date]);
      return { working: true };
    }));
  },
};
