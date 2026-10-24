/**
 * @file
 * Configura la cuenta dedicada de Check-in y registra entradas/salidas.
 * Revalida credenciales, puesto y horario esperado bajo bloqueo.
 */
import { db } from '../../config/database.js';
import { transaction } from '../../shared/transaction.js';
import { ApiError } from '../../shared/errors.js';
import { hashPassword, verifyPassword, normalizeEmail, newToken } from '../../security/crypto.js';
import { businessDate } from '../sales/sales.rules.js';

const dummyHash = await hashPassword(newToken());
// Exige la cuenta dedicada para operar el kiosco.
export function requireCheckIn(actor) {
  if (actor.role !== 'checkin')
    throw new ApiError(403, 'Esta vista requiere una cuenta Check-in.', 'FORBIDDEN');
}
// Exige un puesto antes de consultar o registrar asistencia.
const requireKiosk = actor => {
  requireCheckIn(actor);
  if (!actor.stationId) throw new ApiError(409, 'Seleccioná el puesto desde Opciones.', 'STATION_REQUIRED');
};
// Mismo orden de bloqueo que la gestión de usuarios para serializar bajas y reasignaciones.
// Bloquea y revalida cuenta y sesión antes de modificar kiosco o asistencia.
const managed = (actor, callback) => transaction(async connection => {
  requireCheckIn(actor);
  await connection.query('SELECT id_rol FROM rol ORDER BY id_rol FOR UPDATE');
  const [[manager]] = await connection.execute(`SELECT u.password, u.disponible, u.id_puesto AS stationId, r.nombre AS role
    FROM usuarios u JOIN rol r ON r.id_rol = u.id_rol WHERE u.id_usuario = ? FOR UPDATE`, [actor.id]);
  const [[session]] = await connection.execute(`SELECT check_in_mode AS kioskMode FROM sesiones_usuario
    WHERE id_sesiones_usuario = ? AND id_usuario = ? AND revoked_at IS NULL AND expires_at > UTC_TIMESTAMP(6) FOR UPDATE`, [actor.sessionId, actor.id]);
  if (!manager?.disponible || manager.role !== 'checkin' || manager.stationId !== actor.stationId || !session)
    throw new ApiError(403, 'La autorización cambió. Volvé a iniciar sesión.', 'FORBIDDEN');
  return callback(connection, manager);
});

export const kioskService = {
  // Reasignar y cerrar sesión exigen la contraseña de la cuenta, incluso por API directa.
  async stations(actor, input) {
    requireCheckIn(actor);
    const [rows] = await db.execute(`SELECT id_puesto AS id, nombre AS name FROM puesto
      WHERE disponible = TRUE ORDER BY nombre, id_puesto LIMIT ? OFFSET ?`, [String(input.limit), String(input.offset)]);
    return rows;
  },
  async assign(actor, input) {
    return managed(actor, async (connection, account) => {
      if (!await verifyPassword(input.password, account.password))
        throw new ApiError(401, 'La contraseña de Check-in es incorrecta.', 'INVALID_CREDENTIALS');
      const [[station]] = await connection.execute('SELECT disponible FROM puesto WHERE id_puesto = ? LOCK IN SHARE MODE', [input.stationId]);
      if (!station?.disponible) throw new ApiError(422, 'Seleccioná un puesto activo.');
      await connection.execute('UPDATE usuarios SET id_puesto = ? WHERE id_usuario = ?', [input.stationId, actor.id]);
      return { stationId: input.stationId };
    });
  },
  async exit(actor, input) {
    return managed(actor, async (connection, account) => {
      if (!await verifyPassword(input.password, account.password))
        throw new ApiError(401, 'La contraseña de Check-in es incorrecta.', 'INVALID_CREDENTIALS');
      await connection.execute('UPDATE sesiones_usuario SET revoked_at = UTC_TIMESTAMP(6) WHERE id_sesiones_usuario = ?', [actor.sessionId]);
      return { revoked: true };
    });
  },
  // Lista empleados activos del puesto con su turno abierto para elegir entrada o salida.
  async employees(actor, input) {
    requireKiosk(actor);
    const [rows] = await db.execute(`SELECT u.id_usuario AS id, u.nombre AS firstName, u.apellido AS lastName,
      (SELECT h.id_horario FROM horarios h JOIN dias d ON d.id_dias = h.id_dias
        WHERE h.id_usuario = u.id_usuario AND h.check_out IS NULL AND d.id_puesto = u.id_puesto
        ORDER BY h.id_horario DESC LIMIT 1) AS attendanceId
      FROM usuarios u JOIN rol r ON r.id_rol = u.id_rol
      WHERE u.disponible = 1 AND u.id_puesto = ? AND r.nombre NOT IN ('cliente', 'dueno', 'checkin')
      ORDER BY u.nombre, u.apellido, u.id_usuario LIMIT ? OFFSET ?`, [actor.stationId, String(input.limit), String(input.offset)]);
    return rows.map(row => ({ ...row, working: row.attendanceId !== null }));
  },
  // Verifica credenciales y turno esperado antes de registrar la entrada o salida del empleado.
  async mark(actor, input) {
    requireKiosk(actor);
    return managed(actor, async (connection) => {
      const [[employee]] = await connection.execute(`SELECT u.id_usuario AS id, u.email, u.password, u.disponible,
        u.id_puesto AS stationId, r.nombre AS role FROM usuarios u JOIN rol r ON r.id_rol = u.id_rol
        WHERE u.id_usuario = ? FOR UPDATE`, [input.userId]);
      const valid = await verifyPassword(input.password, employee?.password ?? dummyHash);
      if (!valid || !employee?.disponible || employee.email !== normalizeEmail(input.email) ||
        employee.stationId !== actor.stationId || ['cliente', 'dueno', 'checkin'].includes(employee.role))
        throw new ApiError(401, 'Ingresá el mail y la contraseña del empleado seleccionado.', 'INVALID_CREDENTIALS');
      const [open] = await connection.execute(`SELECT h.id_horario AS id, d.id_puesto AS stationId
        FROM horarios h JOIN dias d ON d.id_dias = h.id_dias
        WHERE h.id_usuario = ? AND h.check_out IS NULL FOR UPDATE`, [input.userId]);
      const current = open.find(row => row.stationId === actor.stationId);
      // El turno recibido funciona como control de concurrencia: una lista vieja no marca dos veces.
      if ((current?.id ?? null) !== input.attendanceId || (input.action === 'check-in' ? open.length > 0 : !current))
        throw new ApiError(409, 'La asistencia cambió o hay una jornada abierta en otro puesto. Actualizá la lista.', 'ATTENDANCE_CHANGED');
      if (input.action === 'check-out') {
        await connection.execute('UPDATE horarios SET check_out = UTC_TIMESTAMP(6) WHERE id_usuario = ? AND check_out IS NULL AND id_dias IN (SELECT id_dias FROM dias WHERE id_puesto = ?)', [input.userId, actor.stationId]);
        return { working: false };
      }
      const date = businessDate();
      await connection.execute('INSERT INTO dias (id_puesto, fecha) VALUES (?, ?) ON DUPLICATE KEY UPDATE id_dias = id_dias', [actor.stationId, date]);
      await connection.execute(`INSERT INTO horarios (id_usuario, id_dias, check_in)
        SELECT ?, id_dias, UTC_TIMESTAMP(6) FROM dias WHERE id_puesto = ? AND fecha = ?`, [input.userId, actor.stationId, date]);
      return { working: true };
    });
  },
};
