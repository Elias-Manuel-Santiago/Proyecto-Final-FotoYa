import { ApiError } from '../../shared/errors.js';
import { stationScope } from '../../security/access.js';

export async function requirePhotoOperator(connection, actor, permission, stationId) {
  const [[current]] = await connection.execute(`SELECT id_puesto AS stationId, id_rol AS roleId FROM usuarios
    WHERE id_usuario = ? AND disponible = 1 FOR UPDATE`, [actor.id]);
  if (!current) throw new ApiError(403, 'La cuenta no está disponible.');
  const [[allowed]] = await connection.execute(`SELECT r.nombre AS role FROM rol r JOIN permisos_rol pr ON pr.id_rol = r.id_rol
    JOIN permisos p ON p.id_permisos = pr.id_permiso WHERE r.id_rol = ? AND p.tipo_de_permiso = ?
    AND EXISTS (SELECT 1 FROM sesiones_usuario WHERE id_sesiones_usuario = ? AND id_usuario = ?
      AND revoked_at IS NULL AND expires_at > UTC_TIMESTAMP(6))`, [current.roleId, permission, actor.sessionId, actor.id]);
  if (!allowed) throw new ApiError(403, 'La autorización cambió. Volvé a iniciar sesión.');
  stationScope({ ...current, ...allowed }, stationId);
}

export async function requireClient(connection, clientId) {
  if (clientId === null) return;
  const [[client]] = await connection.execute(`SELECT u.id_usuario FROM usuarios u JOIN rol r ON r.id_rol = u.id_rol
    WHERE u.id_usuario = ? AND u.disponible = 1 AND r.nombre = 'cliente' LOCK IN SHARE MODE`, [clientId]);
  if (!client) throw new ApiError(422, 'El cliente no existe o no está disponible.', 'INVALID_CLIENT');
}
