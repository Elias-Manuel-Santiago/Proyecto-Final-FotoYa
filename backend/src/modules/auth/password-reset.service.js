/** Recuperación local por código: un uso, diez minutos y cinco intentos por desafío. */
import { randomInt } from 'node:crypto';
import { transaction } from '../../shared/transaction.js';
import { ApiError } from '../../shared/errors.js';
import { hashPassword, newToken, normalizeEmail } from '../../security/crypto.js';
import { sendPasswordReset } from '../../integrations/mail.js';
import { digest, codeDigest } from './registration.service.js';

const eligible = user => Boolean(user?.disponible && !user.auth0_sub && user.role !== 'checkin');

export const passwordResetService = {
  async start(input) {
    const email = normalizeEmail(input.email), recoveryToken = newToken();
    // La misma respuesta evita revelar cuentas inexistentes, sociales o dadas de baja.
    const response = { recoveryToken, email, expiresIn: 600 };
    return transaction(async connection => {
      const [[user]] = await connection.execute(`SELECT u.*, (SELECT nombre FROM rol WHERE id_rol = u.id_rol) AS role
        FROM usuarios u WHERE u.email = ? FOR UPDATE`, [email]);
      if (!eligible(user)) return response;
      const [[recent]] = await connection.execute(`SELECT sent_at > TIMESTAMPADD(SECOND, -60, UTC_TIMESTAMP(6)) AS recent
        FROM tokens_autenticacion WHERE id_usuario = ? AND tipo = 'password_reset' ORDER BY id_tokens DESC LIMIT 1`, [user.id_usuario]);
      // Tampoco se revela la existencia de una cuenta a través de su tiempo de espera.
      if (Number(recent?.recent)) return response;
      const code = String(randomInt(0, 1000000)).padStart(6, '0');
      await connection.execute(`UPDATE tokens_autenticacion SET used_at = UTC_TIMESTAMP(6)
        WHERE id_usuario = ? AND tipo = 'password_reset' AND used_at IS NULL`, [user.id_usuario]);
      await connection.execute(`INSERT INTO tokens_autenticacion (id_usuario, tipo, token, code_hash, expires_at)
        VALUES (?, 'password_reset', ?, ?, TIMESTAMPADD(MINUTE, 10, UTC_TIMESTAMP(6)))`,
      [user.id_usuario, digest(recoveryToken), codeDigest(recoveryToken, code)]);
      // Si Mailtrap falla, se revierte también la invalidación del código anterior.
      await sendPasswordReset(user.email, code);
      return response;
    });
  },

  async confirm({ recoveryToken, code, password }) {
    // Derivar fuera de la transacción evita retener bloqueos durante scrypt.
    const passwordHash = await hashPassword(password);
    const changed = await transaction(async connection => {
      const tokenDigest = digest(recoveryToken);
      const [[target]] = await connection.execute(`SELECT id_usuario FROM tokens_autenticacion
        WHERE token = ? AND tipo = 'password_reset' AND used_at IS NULL`, [tokenDigest]);
      if (!target) return false;
      // Usuario antes que tokens, como cambio de contraseña y reenvío, para evitar bloqueos cruzados.
      const [[user]] = await connection.execute(`SELECT u.*, (SELECT nombre FROM rol WHERE id_rol = u.id_rol) AS role
        FROM usuarios u WHERE u.id_usuario = ? FOR UPDATE`, [target.id_usuario]);
      if (!eligible(user)) return false;
      const [[challenge]] = await connection.execute(`SELECT *, expires_at > UTC_TIMESTAMP(6) AS valid
        FROM tokens_autenticacion WHERE token = ? AND tipo = 'password_reset' AND used_at IS NULL FOR UPDATE`, [tokenDigest]);
      if (!Number(challenge?.valid) || challenge.attempts >= 5) return false;
      if (challenge.code_hash !== codeDigest(recoveryToken, code)) {
        await connection.execute('UPDATE tokens_autenticacion SET attempts = attempts + 1 WHERE id_tokens = ?', [challenge.id_tokens]);
        return false;
      }
      await connection.execute('UPDATE usuarios SET password = ? WHERE id_usuario = ?', [passwordHash, user.id_usuario]);
      await connection.execute('UPDATE sesiones_usuario SET revoked_at = UTC_TIMESTAMP(6) WHERE id_usuario = ? AND revoked_at IS NULL', [user.id_usuario]);
      await connection.execute('UPDATE tokens_autenticacion SET used_at = UTC_TIMESTAMP(6) WHERE id_usuario = ? AND used_at IS NULL', [user.id_usuario]);
      return true;
    });
    // El error queda fuera para confirmar los intentos fallidos en la base.
    if (!changed) throw new ApiError(422, 'Código incorrecto, vencido o bloqueado. Solicitá uno nuevo.', 'INVALID_CODE');
    return { changed: true, loginRequired: true };
  },
};
