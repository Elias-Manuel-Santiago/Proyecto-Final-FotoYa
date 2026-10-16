import { ApiError } from '../../shared/errors.js';
import { transaction } from '../../shared/transaction.js';
import { assertAssignable } from '../../security/access.js';
import { hashPassword, normalizeEmail } from '../../security/crypto.js';

export function createUserService(db, repository, privacy) {
  const publicUser = row => ({ id: row.id, firstName: privacy.decrypt(row.nombre, 'nombre'),
    lastName: privacy.decrypt(row.apellido, 'apellido'), email: privacy.decrypt(row.email, 'email'),
    dni: privacy.decrypt(row.dni, 'dni'), roleId: String(row.roleId), role: row.role,
    stationId: row.stationId, active: Boolean(row.active), createdAt: row.created_at, updatedAt: row.updated_at });
  const encrypted = input => [privacy.encrypt(input.firstName, 'nombre'), privacy.encrypt(input.lastName, 'apellido'),
    privacy.encrypt(normalizeEmail(input.email), 'email'), privacy.encrypt(input.dni, 'dni'),
    privacy.hash(normalizeEmail(input.email), 'email'), privacy.hash(input.dni, 'dni')];
  const target = async (actor, id, connection) => {
    const row = await repository.find(id, connection);
    if (!repository.canRead(actor, row)) throw new ApiError(404, 'El usuario no existe.');
    if (actor.role !== 'dueno') assertAssignable(actor, row.role, row.stationId);
    return row;
  };
  // Serializa cambios de asignación/baja y revalida al administrador dentro de la transacción.
  const managed = (actor, callback) => transaction(db, async connection => {
    await connection.execute("SELECT name FROM backend_locks WHERE name = 'users' FOR UPDATE");
    const current = await repository.find(actor.id, connection);
    if (!current?.active) throw new ApiError(403, 'La cuenta está deshabilitada.');
    const [[session]] = await connection.execute(`SELECT id_sesiones_usuario FROM sesiones_usuario
      WHERE id_sesiones_usuario = ? AND revoked_at IS NULL AND expires_at > UTC_TIMESTAMP(6)`, [actor.sessionId]);
    const [[permission]] = await connection.execute(`SELECT pr.id_permiso FROM permisos_rol pr
      JOIN permisos p ON p.id_permisos = pr.id_permiso WHERE pr.id_rol = ? AND p.tipo_de_permiso = 'employees.manage'`, [current.roleId]);
    if (!session || !permission || current.role !== actor.role || current.stationId !== actor.stationId)
      throw new ApiError(403, 'La autorización cambió. Volvé a iniciar sesión.');
    return callback(connection);
  });
  const assignment = async (actor, input, connection) => {
    const role = await repository.role(input.roleId, connection);
    if (!role) throw new ApiError(422, 'El rol no existe.');
    if (['encargado', 'camarografo', 'vendedor'].includes(role) && !input.stationId) throw new ApiError(422, 'El rol requiere un puesto.');
    assertAssignable(actor, role, input.stationId);
  };
  return {
    async profile(actor) { return { ...publicUser(await repository.find(actor.id)), permissions: actor.permissions }; },
    async query(actor, input) {
      const rows = await repository.query(actor, { ...input,
        emailHash: input.email ? privacy.hash(normalizeEmail(input.email), 'email') : undefined,
        dniHash: input.dni ? privacy.hash(input.dni, 'dni') : undefined });
      return rows.map(publicUser);
    },
    async detail(actor, userId) {
      const row = await repository.find(userId);
      if (!repository.canRead(actor, row)) throw new ApiError(404, 'El usuario no existe.');
      return publicUser(row);
    },
    async create(actor, input) {
      const password = await hashPassword(input.password);
      return managed(actor, async connection => {
        await assignment(actor, input, connection);
        const [result] = await connection.execute(`INSERT INTO usuarios
          (nombre, apellido, email, dni, email_hash, dni_hash, password, id_rol, id_puesto) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [...encrypted(input), password, input.roleId, input.stationId]);
        return publicUser(await repository.find(String(result.insertId), connection));
      });
    },
    async update(actor, input) {
      return managed(actor, async connection => {
        await target(actor, input.userId, connection);
        await assignment(actor, input, connection);
        if (input.userId === actor.id && (input.roleId !== String((await repository.find(actor.id, connection)).roleId) || input.stationId !== actor.stationId))
          throw new ApiError(409, 'No podés cambiar tu propia asignación.');
        await connection.execute(`UPDATE usuarios SET nombre = ?, apellido = ?, email = ?, dni = ?, email_hash = ?, dni_hash = ?,
          id_rol = ?, id_puesto = ? WHERE id_usuario = ?`, [...encrypted(input), input.roleId, input.stationId, input.userId]);
        await connection.execute('UPDATE sesiones_usuario SET revoked_at = UTC_TIMESTAMP(6) WHERE id_usuario = ? AND revoked_at IS NULL', [input.userId]);
        return publicUser(await repository.find(input.userId, connection));
      });
    },
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
}
