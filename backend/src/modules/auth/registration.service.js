/**
 * @file
 * Coordina alta de clientes, identidad social y confirmación de correo. Guarda digests de
 * desafío/código, limita intentos y emite sesiones propias.
 */
import { createHash, randomInt } from 'node:crypto';
import { db } from '../../config/database.js';
import { env } from '../../config/env.js';
import { transaction } from '../../shared/transaction.js';
import { ApiError } from '../../shared/errors.js';
import { hashPassword, verifyPassword, newToken, normalizeEmail } from '../../security/crypto.js';
import { sendVerification } from '../../integrations/mail.js';
import { socialIdentity } from '../../integrations/auth0.js';

// Resume el desafío para buscarlo sin persistir su valor original.
export const digest = value => createHash('sha256').update(value).digest('hex');
// Vincula el código al desafío para impedir su reutilización con otro token.
export const codeDigest = (token, code) => digest(`${token}:${code}`);
// Aplica la espera entre envíos, renueva el desafío y envía un código válido por diez minutos.
const issueCode = async (connection, user) => {
  const [[recent]] = await connection.execute('SELECT sent_at > TIMESTAMPADD(SECOND, -60, UTC_TIMESTAMP(6)) AS recent FROM client_verifications WHERE id_usuario = ?', [user.id_usuario]);
  if (Number(recent?.recent)) throw new ApiError(429, 'Esperá un minuto antes de pedir otro código.', 'CODE_COOLDOWN');
  const verificationToken = newToken(), code = String(randomInt(0, 1000000)).padStart(6, '0');
  await connection.execute(`INSERT INTO client_verifications (id_usuario, challenge, code_hash, expires_at)
    VALUES (?, ?, ?, TIMESTAMPADD(MINUTE, 10, UTC_TIMESTAMP(6)))
    ON DUPLICATE KEY UPDATE challenge = ?, code_hash = ?,
    expires_at = TIMESTAMPADD(MINUTE, 10, UTC_TIMESTAMP(6)), sent_at = UTC_TIMESTAMP(6), attempts = 0`,
    [user.id_usuario, digest(verificationToken), codeDigest(verificationToken, code), digest(verificationToken), codeDigest(verificationToken, code)]);
  await sendVerification(user.email, code);
  return { verificationToken, email: user.email, expiresIn: 600 };
};
// Persiste una sesión propia y devuelve el Bearer con su tiempo de vida.
const session = async (connection, user) => {
  const token = newToken();
  await connection.execute(`INSERT INTO sesiones_usuario (id_usuario, token, expires_at)
    VALUES (?, ?, TIMESTAMPADD(HOUR, ?, UTC_TIMESTAMP(6)))`, [user.id_usuario, token, env.SESSION_HOURS]);
  return { token, tokenType: 'Bearer', expiresIn: env.SESSION_HOURS * 3600 };
};
// Crea la cuenta cliente y pide confirmar el correo antes de habilitar el acceso.
async function createClient(input, identity) {
  const password = await hashPassword(identity ? newToken() : input.password);
  return transaction(async connection => {
    const [[role]] = await connection.execute("SELECT id_rol FROM rol WHERE nombre = 'cliente' LOCK IN SHARE MODE");
    if (!role) throw new ApiError(503, 'El rol cliente no está configurado.');
    const email = identity?.email ?? normalizeEmail(input.email);
    const [result] = await connection.execute(`INSERT INTO usuarios (nombre, apellido, email, dni, password, id_rol, email_verified, auth0_sub)
      VALUES (?, ?, ?, ?, ?, ?, FALSE, ?)`, [input.firstName, input.lastName, email, input.dni, password, role.id_rol, identity?.subject ?? null]);
    return issueCode(connection, { id_usuario: result.insertId, email });
  });
}
export const registrationService = {
  register: input => createClient(input),
  // Retoma la confirmación de una cuenta local después de verificar sus credenciales.
  async start(input) {
    return transaction(async connection => {
      const [[user]] = await connection.execute('SELECT * FROM usuarios WHERE email = ? FOR UPDATE', [normalizeEmail(input.email)]);
      if (!user?.disponible || !await verifyPassword(input.password, user.password)) throw new ApiError(401, 'Correo o contraseña incorrectos.', 'INVALID_CREDENTIALS');
      if (user.email_verified) throw new ApiError(409, 'El correo ya está confirmado.');
      return issueCode(connection, user);
    });
  },
  // Localiza la cuenta por el desafío y reemplaza el código respetando la espera entre envíos.
  async resend({ verificationToken }) {
    return transaction(async connection => {
      const [[user]] = await connection.execute(`SELECT u.* FROM usuarios u JOIN client_verifications v ON v.id_usuario = u.id_usuario
        WHERE v.challenge = ? FOR UPDATE`, [digest(verificationToken)]);
      if (!user?.disponible || user.email_verified) throw new ApiError(422, 'La verificación ya no está disponible.');
      return issueCode(connection, user);
    });
  },
  // Confirma el correo y emite sesión en una transacción; conserva el conteo de intentos fallidos.
  async verify({ verificationToken, code }) {
    const result = await transaction(async connection => {
      // Bloquear usuario antes de cambiar su verificación o emitir una sesión.
      const [[user]] = await connection.execute(`SELECT u.* FROM usuarios u JOIN client_verifications v ON v.id_usuario = u.id_usuario
        WHERE v.challenge = ? FOR UPDATE`, [digest(verificationToken)]);
      if (!user?.disponible || user.email_verified) return null;
      const [[verification]] = await connection.execute(`SELECT *, expires_at > UTC_TIMESTAMP(6) AS valid
        FROM client_verifications WHERE id_usuario = ? FOR UPDATE`, [user.id_usuario]);
      if (!Number(verification.valid) || verification.attempts >= 5) return null;
      if (verification.code_hash !== codeDigest(verificationToken, code)) {
        // Se devuelve null para confirmar el incremento; lanzar aquí revertiría el intento fallido.
        await connection.execute('UPDATE client_verifications SET attempts = attempts + 1 WHERE id_usuario = ?', [user.id_usuario]);
        return null;
      }
      await connection.execute('UPDATE usuarios SET email_verified = TRUE WHERE id_usuario = ?', [user.id_usuario]);
      await connection.execute('DELETE FROM client_verifications WHERE id_usuario = ?', [user.id_usuario]);
      return session(connection, user);
    });
    // El error se emite después del commit para conservar el límite de intentos.
    if (!result) throw new ApiError(422, 'Código incorrecto, vencido o bloqueado. Solicitá uno nuevo.', 'INVALID_CODE');
    return result;
  },
  // Resuelve la identidad externa: inicia sesión, pide confirmación o solicita datos faltantes.
  async social(input) {
    const identity = await socialIdentity(input.idToken);
    const [[found]] = await db.execute('SELECT id_usuario FROM usuarios WHERE auth0_sub = ?', [identity.subject]);
    if (found) return transaction(async connection => {
      const [[user]] = await connection.execute(`SELECT u.*, r.nombre AS role FROM usuarios u JOIN rol r ON r.id_rol = u.id_rol
        WHERE u.id_usuario = ? FOR UPDATE`, [found.id_usuario]);
      if (!user?.disponible || user.role !== 'cliente') throw new ApiError(403, 'La cuenta no está disponible.');
      return user.email_verified ? session(connection, user) : issueCode(connection, user);
    });
    // Un correo ya registrado no se vincula automáticamente a una identidad externa nueva.
    const [[existing]] = await db.execute('SELECT id_usuario FROM usuarios WHERE email = ?', [identity.email]);
    if (existing) throw new ApiError(409, 'Este correo ya tiene una cuenta. Ingresá con su método original.', 'ACCOUNT_EXISTS');
    if (!input.firstName || !input.lastName || !input.dni) return { registrationRequired: true, email: identity.email };
    return createClient(input, identity);
  },
};
