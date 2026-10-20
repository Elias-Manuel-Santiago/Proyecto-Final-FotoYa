import { decryptLegacy } from './legacy-data.js';
import { hashPassword, normalizeEmail, normalizeDni } from '../../src/security/crypto.js';

export async function protectUsers(connection, env) {
  const [users] = await connection.query('SELECT id_usuario, nombre, apellido, email, dni, password FROM usuarios FOR UPDATE');
  for (const user of users) {
    const fields = ['nombre', 'apellido', 'email', 'dni'];
    const plain = Object.fromEntries(fields.map(field => [field,
      user[field].startsWith('enc:v1:') ? decryptLegacy(user[field], field, env) : user[field]]));
    plain.email = normalizeEmail(plain.email); plain.dni = normalizeDni(plain.dni);
    const supportedPassword = /^scrypt\$[a-f\d]{32}\$[a-f\d]{128}$/.test(user.password);
    if (!supportedPassword && /^(\$|scrypt\$|[a-f\d]{64}$)/i.test(user.password))
      throw new Error('Existe un hash de contraseña de otro formato. Se requiere una migración específica de credenciales.');
    if (supportedPassword && fields.every(field => user[field] === plain[field])) continue;
    await connection.execute(`UPDATE usuarios SET nombre = ?, apellido = ?, email = ?, dni = ?, password = ?, updated_at = updated_at WHERE id_usuario = ?`,
      [...fields.map(field => plain[field]),
        supportedPassword ? user.password : await hashPassword(user.password), user.id_usuario]);
  }
}
