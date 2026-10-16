import { randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(scrypt);
const options = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
export const newToken = () => randomBytes(32).toString('base64url');
export const normalizeEmail = value => value.trim().toLowerCase();
export const normalizeDni = value => value.replace(/[.\s-]/g, '');

export async function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  const hash = await derive(password, salt, 64, options);
  return `scrypt$${salt}$${hash.toString('hex')}`;
}

export async function verifyPassword(password, encoded) {
  const [, salt, expected] = /^scrypt\$([a-f\d]{32})\$([a-f\d]{128})$/.exec(encoded ?? '') ?? [];
  if (!salt) return false;
  const actual = await derive(password, salt, 64, options);
  return timingSafeEqual(actual, Buffer.from(expected, 'hex'));
}
