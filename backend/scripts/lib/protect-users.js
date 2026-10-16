import { hashPassword, normalizeEmail, normalizeDni } from '../../src/security/crypto.js';

export async function protectUsers(connection, privacy) {
  const [users] = await connection.query('SELECT id_usuario, nombre, apellido, email, dni, email_hash, dni_hash, password FROM usuarios FOR UPDATE');
  for (const user of users) {
    const fields = ['nombre', 'apellido', 'email', 'dni'];
    const plain = Object.fromEntries(fields.map(field => [field,
      user[field].startsWith('enc:v1:') ? privacy.decrypt(user[field], field) : user[field]]));
    plain.email = normalizeEmail(plain.email); plain.dni = normalizeDni(plain.dni);
    const emailHash = privacy.hash(plain.email, 'email'), dniHash = privacy.hash(plain.dni, 'dni');
    if (user.email_hash && user.email_hash !== emailHash || user.dni_hash && user.dni_hash !== dniHash)
      throw new Error('La clave de búsqueda no coincide con los datos existentes.');
    const supportedPassword = /^scrypt\$[a-f\d]{32}\$[a-f\d]{128}$/.test(user.password);
    if (!supportedPassword && /^(\$|scrypt\$|[a-f\d]{64}$)/i.test(user.password))
      throw new Error('Existe un hash de contraseña de otro formato. Se requiere una migración específica de credenciales.');
    if (supportedPassword && user.email_hash && user.dni_hash && fields.every(field => user[field].startsWith('enc:v1:'))) continue;
    await connection.execute(`UPDATE usuarios SET nombre = ?, apellido = ?, email = ?, dni = ?, email_hash = ?, dni_hash = ?, password = ?, updated_at = updated_at WHERE id_usuario = ?`,
      [...fields.map(field => privacy.encrypt(plain[field], field)), emailHash, dniHash,
        supportedPassword ? user.password : await hashPassword(user.password), user.id_usuario]);
  }
}
