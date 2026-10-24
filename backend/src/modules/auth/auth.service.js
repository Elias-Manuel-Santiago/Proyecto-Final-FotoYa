/**
 * @file
 * Valida login local y crea sesiones con vencimiento. Cambiar contraseña verifica la anterior
 * y revoca sesiones/tokens en una transacción.
 */
import { env } from '../../config/env.js';
import { authRepository } from './auth.repository.js';
import { ApiError } from '../../shared/errors.js';
import { transaction } from '../../shared/transaction.js';
import { hashPassword, verifyPassword, newToken, normalizeEmail } from '../../security/crypto.js';

const dummyHash = await hashPassword(newToken());
export const authService = {
  // Comprueba cuenta y contraseña antes de emitir y guardar una nueva sesión.
  async login(input) {
    const user = await authRepository.byEmail(normalizeEmail(input.email));
    // El hash ficticio mantiene la verificación costosa aun cuando el correo no existe.
    const valid = await verifyPassword(input.password, user?.password ?? dummyHash);
    if (!valid || !user?.disponible) throw new ApiError(401, 'Correo o contraseña incorrectos.', 'INVALID_CREDENTIALS');
    if (!user.email_verified) throw new ApiError(403, 'Confirmá tu correo para ingresar.', 'EMAIL_UNVERIFIED');
    const token = newToken();
    await transaction(async connection => {
      // Mantiene el orden de bloqueo usado por activación de kiosco y edición de usuarios.
      await connection.query('SELECT id_rol FROM rol ORDER BY id_rol FOR UPDATE');
      // Se reconsulta bajo bloqueo para no emitir sesión con una contraseña o disponibilidad anterior.
      const [[current]] = await connection.execute(`SELECT u.password, u.disponible, u.email_verified, r.nombre AS role
        FROM usuarios u JOIN rol r ON r.id_rol = u.id_rol WHERE u.id_usuario = ? FOR UPDATE`, [user.id_usuario]);
      if (!current?.disponible || current.password !== user.password) throw new ApiError(401, 'Correo o contraseña incorrectos.', 'INVALID_CREDENTIALS');
      if (!current.email_verified) throw new ApiError(403, 'Confirmá tu correo para ingresar.', 'EMAIL_UNVERIFIED');
      if (current.role === 'checkin') throw new ApiError(403, 'Ingresá con la cuenta del encargado.');
      // Un nuevo login reemplaza solo el dispositivo de trabajo; conserva el kiosco.
      if (current.role === 'encargado') await connection.execute(`UPDATE sesiones_usuario SET revoked_at = UTC_TIMESTAMP(6)
        WHERE id_usuario = ? AND check_in_mode = FALSE AND revoked_at IS NULL`, [user.id_usuario]);
      await connection.execute(`INSERT INTO sesiones_usuario (id_usuario, token, expires_at)
        VALUES (?, ?, TIMESTAMPADD(HOUR, ?, UTC_TIMESTAMP(6)))`, [user.id_usuario, token, env.SESSION_HOURS]);
    });
    return { token, tokenType: 'Bearer', expiresIn: env.SESSION_HOURS * 3600 };
  },
  // Revalida la contraseña actual y cambia el hash revocando las sesiones del usuario.
  async changePassword(actor, input) {
    const password = await hashPassword(input.password);
    await transaction(async connection => {
      const [[user]] = await connection.execute('SELECT password FROM usuarios WHERE id_usuario = ? FOR UPDATE', [actor.id]);
      if (!await verifyPassword(input.currentPassword, user.password)) throw new ApiError(401, 'La contraseña actual es incorrecta.');
      await connection.execute('UPDATE usuarios SET password = ? WHERE id_usuario = ?', [password, actor.id]);
      await connection.execute('UPDATE sesiones_usuario SET revoked_at = UTC_TIMESTAMP(6) WHERE id_usuario = ? AND revoked_at IS NULL', [actor.id]);
      await connection.execute('UPDATE tokens_autenticacion SET used_at = UTC_TIMESTAMP(6) WHERE id_usuario = ? AND used_at IS NULL', [actor.id]);
    });
    return { changed: true, loginRequired: true };
  },
};
