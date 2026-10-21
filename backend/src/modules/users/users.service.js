/**
 * @file
 * Gestiona usuarios con revalidación transaccional del administrador. Omite hashes en
 * respuestas y revoca sesiones al editar o dar de baja.
 */
import { userRepository } from './users.repository.js';
import { ApiError } from '../../shared/errors.js';
import { transaction } from '../../shared/transaction.js';
import { assertAssignable } from '../../security/access.js';
import { hashPassword, normalizeEmail } from '../../security/crypto.js';

// Adapta la fila a datos públicos sin exponer credenciales.
const publicUser = row => ({ id: row.id, firstName: row.nombre,
  lastName: row.apellido, email: row.email,
  dni: row.dni, roleId: String(row.roleId), role: row.role,
  stationId: row.stationId, stationName: row.stationName, active: Boolean(row.active), createdAt: row.created_at, updatedAt: row.updated_at });
// Ordena campos personales y normaliza el correo para las escrituras SQL.
const personalData = input => [input.firstName, input.lastName, normalizeEmail(input.email), input.dni];
// Resuelve el usuario objetivo y comprueba que el actor pueda administrarlo.
const target = async (actor, id, connection) => {
  const row = await userRepository.find(id, connection);
  if (!userRepository.canRead(actor, row)) throw new ApiError(404, 'El usuario no existe.');
  if (actor.role !== 'dueno') assertAssignable(actor, row.role, row.stationId);
  return row;
};
// Serializa cambios de asignación/baja y revalida al administrador dentro de la transacción.
// Serializa cambios y revalida cuenta, sesión, rol y permiso del administrador.
const managed = (actor, callback) => transaction(async connection => {
  await connection.query('SELECT id_rol FROM rol ORDER BY id_rol FOR UPDATE');
  const current = await userRepository.find(actor.id, connection);
  if (!current?.active) throw new ApiError(403, 'La cuenta está deshabilitada.');
  const [[session]] = await connection.execute(`SELECT id_sesiones_usuario FROM sesiones_usuario
    WHERE id_sesiones_usuario = ? AND revoked_at IS NULL AND expires_at > UTC_TIMESTAMP(6)`, [actor.sessionId]);
  const [[permission]] = await connection.execute(`SELECT pr.id_permiso FROM permisos_rol pr
    JOIN permisos p ON p.id_permisos = pr.id_permiso WHERE pr.id_rol = ? AND p.tipo_de_permiso = 'employees.manage'`, [current.roleId]);
  if (!session || !permission || current.role !== actor.role || current.stationId !== actor.stationId)
    throw new ApiError(403, 'La autorización cambió. Volvé a iniciar sesión.');
  return callback(connection);
});
// Valida rol y puesto, permitiendo conservar una asignación previa a un puesto inactivo.
const assignment = async (actor, input, connection) => {
  const role = await userRepository.role(input.roleId, connection);
  if (!role) throw new ApiError(422, 'El rol no existe.');
  if (['encargado', 'camarografo', 'vendedor'].includes(role) && !input.stationId) throw new ApiError(422, 'El rol requiere un puesto.');
  assertAssignable(actor, role, input.stationId);
  if (input.stationId) {
    const [[station]] = await connection.execute('SELECT disponible AS active FROM puesto WHERE id_puesto = ? LOCK IN SHARE MODE', [input.stationId]);
    const existing = input.userId ? await userRepository.find(input.userId, connection) : null;
    if (!station || (!station.active && existing?.stationId !== input.stationId))
      throw new ApiError(422, 'Seleccioná un puesto activo.');
  }
};
export const userService = {
  // Combina datos personales con permisos, jornada y kiosco de la sesión actual.
  async profile(actor) { return { ...publicUser(await userRepository.find(actor.id)), permissions: actor.permissions,
    working: actor.working, kioskMode: actor.kioskMode }; },
  // Normaliza el filtro de correo y convierte las filas visibles al contrato público.
  async query(actor, input) {
    const rows = await userRepository.query(actor, { ...input,
      email: input.email ? normalizeEmail(input.email) : undefined });
    return rows.map(publicUser);
  },
  // Devuelve un usuario visible o responde como inexistente si está fuera del alcance.
  async detail(actor, userId) {
    const row = await userRepository.find(userId);
    if (!userRepository.canRead(actor, row)) throw new ApiError(404, 'El usuario no existe.');
    return publicUser(row);
  },
  // Genera el hash y crea el usuario tras validar su asignación dentro de la transacción.
  async create(actor, input) {
    const password = await hashPassword(input.password);
    return managed(actor, async connection => {
      await assignment(actor, input, connection);
      const [result] = await connection.execute(`INSERT INTO usuarios
        (nombre, apellido, email, dni, password, id_rol, id_puesto) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [...personalData(input), password, input.roleId, input.stationId]);
      return publicUser(await userRepository.find(String(result.insertId), connection));
    });
  },
  // Actualiza datos y asignación; revoca sesiones para aplicar cambios al reingresar.
  async update(actor, input) {
    return managed(actor, async connection => {
      await target(actor, input.userId, connection);
      await assignment(actor, input, connection);
      if (input.userId === actor.id && (input.roleId !== String((await userRepository.find(actor.id, connection)).roleId) || input.stationId !== actor.stationId))
        throw new ApiError(409, 'No podés cambiar tu propia asignación.');
      await connection.execute(`UPDATE usuarios SET nombre = ?, apellido = ?, email = ?, dni = ?,
        id_rol = ?, id_puesto = ? WHERE id_usuario = ?`, [...personalData(input), input.roleId, input.stationId, input.userId]);
      await connection.execute('UPDATE sesiones_usuario SET revoked_at = UTC_TIMESTAMP(6) WHERE id_usuario = ? AND revoked_at IS NULL', [input.userId]);
      return publicUser(await userRepository.find(input.userId, connection));
    });
  },
  // Cambia disponibilidad y revoca credenciales en la baja, evitando desactivar la propia cuenta.
  async setActive(actor, input) {
    return managed(actor, async connection => {
      await target(actor, input.userId, connection);
      if (!input.active && input.userId === actor.id) throw new ApiError(409, 'No podés dar de baja tu propia cuenta.');
      await connection.execute('UPDATE usuarios SET disponible = ? WHERE id_usuario = ?', [input.active, input.userId]);
      if (!input.active) {
        await connection.execute('UPDATE sesiones_usuario SET revoked_at = UTC_TIMESTAMP(6) WHERE id_usuario = ? AND revoked_at IS NULL', [input.userId]);
        await connection.execute('UPDATE tokens_autenticacion SET used_at = UTC_TIMESTAMP(6) WHERE id_usuario = ? AND used_at IS NULL', [input.userId]);
      }
      return { id: input.userId, active: input.active };
    });
  },
};
