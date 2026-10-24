import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { env } from '../config/env.js';
import { ApiError } from '../shared/errors.js';

function key() {
  if (!env.DATA_ENCRYPTION_KEY)
    throw new ApiError(503, 'Configurá DATA_ENCRYPTION_KEY para administrar contraseñas de Check-in.');
  return Buffer.from(env.DATA_ENCRYPTION_KEY, 'hex');
}

// La identidad impide intercambiar el secreto cifrado entre cuentas.
export function encryptCheckInPassword(password, identity) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  cipher.setAAD(Buffer.from(`checkin:${identity}`));
  const ciphertext = Buffer.concat([cipher.update(password, 'utf8'), cipher.final()]);
  return [iv, cipher.getAuthTag(), ciphertext].map(value => value.toString('base64url')).join('.');
}

export function decryptCheckInPassword(encoded, identity) {
  const [iv, tag, ciphertext] = encoded.split('.').map(value => Buffer.from(value, 'base64url'));
  const decipher = createDecipheriv('aes-256-gcm', key(), iv);
  decipher.setAAD(Buffer.from(`checkin:${identity}`));
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}
