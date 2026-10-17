import { env } from '../../config/env.js';
import { authRepository } from './auth.repository.js';
import { ApiError } from '../../shared/errors.js';
import { transaction } from '../../shared/transaction.js';
import { hashPassword, verifyPassword, newToken, normalizeEmail } from '../../security/crypto.js';

const dummyHash = await hashPassword(newToken());
export const authService = {
  async login(input) {
    const user = await authRepository.byEmail(normalizeEmail(input.email));
    const valid = await verifyPassword(input.password, user?.password ?? dummyHash);
    if (!valid || !user?.disponible) throw new ApiError(401, 'Correo o contraseña incorrectos.', 'INVALID_CREDENTIALS');
    const token = newToken();
    await transaction(async connection => {
      const [[current]] = await connection.execute('SELECT password, disponible FROM usuarios WHERE id_usuario = ? FOR UPDATE', [user.id_usuario]);
      if (!current?.disponible || current.password !== user.password) throw new ApiError(401, 'Correo o contraseña incorrectos.', 'INVALID_CREDENTIALS');
      await connection.execute(`INSERT INTO sesiones_usuario (id_usuario, token, expires_at)
        VALUES (?, ?, TIMESTAMPADD(HOUR, ?, UTC_TIMESTAMP(6)))`, [user.id_usuario, token, env.SESSION_HOURS]);
    });
    return { token, tokenType: 'Bearer', expiresIn: env.SESSION_HOURS * 3600 };
  },
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
