import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const derive = promisify(scrypt);
const options = { N: 131072, r: 8, p: 1, maxmem: 256 * 1024 * 1024 };
export const tokenHash = token => createHash('sha256').update(token).digest('hex');
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

export function createPrivacy(env) {
  const key = Buffer.from(env.DATA_ENCRYPTION_KEY, 'hex');
  return {
    hash: (value, field) => createHmac('sha256', Buffer.from(env.LOOKUP_HASH_KEY, 'hex')).update(`${field}:${value}`).digest('hex'),
    encrypt(value, field) {
      const iv = randomBytes(12), cipher = createCipheriv('aes-256-gcm', key, iv);
      cipher.setAAD(Buffer.from(field));
      const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
      return `enc:v1:${Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64')}`;
    },
    decrypt(value, field) {
      if (!value?.startsWith('enc:v1:')) throw new Error('Datos personales sin migrar.');
      const bytes = Buffer.from(value.slice(7), 'base64');
      const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
      decipher.setAAD(Buffer.from(field)); decipher.setAuthTag(bytes.subarray(12, 28));
      return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8');
    },
  };
}
