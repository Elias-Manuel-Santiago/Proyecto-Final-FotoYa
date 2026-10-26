/**
 * @file
 * Genera/verifica hashes scrypt, emite tokens aleatorios y normaliza identidad. Las
 * contraseñas no se recuperan desde su hash.
 */
import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(scrypt);
const options = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
// Genera una credencial aleatoria de 32 bytes para sesiones o desafíos.
export const newToken = () => randomBytes(32).toString('base64url');
// Unifica espacios y mayúsculas antes de comparar o guardar correos.
export const normalizeEmail = value => value.trim().toLowerCase();
// Quita separadores admitidos para comparar el DNI por sus dígitos.
export const normalizeDni = value => value.replace(/[.\s-]/g, '');

// Deriva el hash con una sal nueva y conserva los datos necesarios para verificarlo.
export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await derive(password, salt, 64, options);
  return `scrypt$${salt}$${hash.toString('hex')}`;
}

// Valida el formato guardado y compara la derivación con una comparación de tiempo constante.
export async function verifyPassword(password, encoded) {
  const [, salt, expected] = /^scrypt\$([a-f\d]{32})\$([a-f\d]{128})$/.exec(encoded ?? '') ?? [];
  if (!salt) return false;
  const actual = await derive(password, salt, 64, options);
  return timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}
