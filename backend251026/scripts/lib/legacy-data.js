/**
 * @file
 * Reconoce y convierte datos heredados. Encapsula compatibilidad con valores cifrados y
 * formatos anteriores para la migración.
 */
import { createDecipheriv } from 'node:crypto';

// Compatibilidad exclusiva de la migración: la API no importa este módulo.
export function decryptLegacy(value, field, env) {
  if (!/^[a-f\d]{64}$/i.test(env.DATA_ENCRYPTION_KEY ?? ''))
    throw new Error('Se necesita la DATA_ENCRYPTION_KEY anterior (32 bytes hexadecimales) para convertir los datos existentes.');
  const key = Buffer.from(env.DATA_ENCRYPTION_KEY, 'hex');
  const bytes = Buffer.from(value.slice(7), 'base64');
  const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
  decipher.setAAD(Buffer.from(field));
  decipher.setAuthTag(bytes.subarray(12, 28));
  return Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString('utf8');
}
