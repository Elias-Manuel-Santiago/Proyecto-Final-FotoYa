/**
 * @file
 * Carga y valida el entorno antes de iniciar servicios. Centraliza conexión, límites y
 * configuración de almacenamiento, correo e identidad externa.
 */
import 'dotenv/config';
import { z } from 'zod';

// Define un entero de configuración con valor predeterminado y límites explícitos.
const positive = (fallback, max) => z.coerce.number().int().min(1).max(max).default(fallback);
const storageSecret = z.string().refine(value => {
  if (/^sb_secret_[A-Za-z0-9_-]+$/.test(value)) return true;
  try {
    const parts = value.split('.');
    return parts.length === 3 && JSON.parse(Buffer.from(parts[1], 'base64url')).role === 'service_role';
  } catch { return false; }
}, 'Usá una clave API sb_secret_... o service_role; las claves S3 y publishable no sirven para este backend.');
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('127.0.0.1'), PORT: positive(3000, 65535),
  CORS_ORIGINS: z.string().min(1).transform(value => value.split(',').map(v => v.trim())),
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
  AUTH0_DOMAIN: z.string().regex(/^[a-zA-Z0-9.-]+$/).optional(),
  AUTH0_CLIENT_IDS: z.string().optional(),
  AUTH0_MANAGEMENT_CLIENT_ID: z.string().optional(),
  AUTH0_MANAGEMENT_CLIENT_SECRET: z.string().optional(),
  MAIL_API_KEY: z.string().optional(), MAIL_INBOX_ID: z.string().regex(/^\d+$/).optional(),
  SENDER: z.email().optional(),
  DB_HOST: z.string().min(1), DB_PORT: positive(3306, 65535), DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1), DB_PASSWORD: z.string(), DB_CONNECTION_LIMIT: positive(2, 50),
  DB_IDLE_TIMEOUT_MS: positive(10000, 600000),
  DB_SSL_CA_PATH: z.string().optional(),
  SESSION_HOURS: positive(8, 720), SUPABASE_URL: z.url().refine(value => {
    const url = new URL(value);
    return url.protocol === 'https:' && ['','/'].includes(url.pathname) && !url.search && !url.hash &&
      !url.username && !url.password && !url.hostname.endsWith('.storage.supabase.co');
  }, 'Usá la URL del proyecto (https://<project-ref>.supabase.co), sin /storage/v1/s3. No uses el endpoint S3.'),
  SUPABASE_SECRET_KEY: storageSecret, SUPABASE_STORAGE_BUCKET: z.string().regex(/^[a-z\d][a-z\d_-]{0,62}$/i),
  PHOTO_URL_SECONDS: positive(60, 300), STORAGE_TIMEOUT_MS: positive(15000, 30000),
});

// Valida el entorno completo y detiene el arranque indicando las opciones inválidas.
export function loadEnv(source = process.env) {
  const result = schema.safeParse(source);
  if (!result.success) throw new Error(`Configuración inválida: ${result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  return result.data;
}

export const env = loadEnv();
