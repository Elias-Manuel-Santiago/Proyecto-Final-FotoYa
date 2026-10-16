import 'dotenv/config';
import { z } from 'zod';

const positive = (fallback, max) => z.coerce.number().int().min(1).max(max).default(fallback);
const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('127.0.0.1'), PORT: positive(3000, 65535),
  CORS_ORIGINS: z.string().min(1).transform(value => value.split(',').map(v => v.trim())),
  TRUST_PROXY: z.coerce.number().int().min(0).max(5).default(0),
  DB_HOST: z.string().min(1), DB_PORT: positive(3306, 65535), DB_NAME: z.string().min(1),
  DB_USER: z.string().min(1), DB_PASSWORD: z.string(), DB_CONNECTION_LIMIT: positive(2, 50),
  DB_IDLE_TIMEOUT_MS: positive(10000, 600000),
  DB_SSL_CA_PATH: z.string().optional(),
  SESSION_HOURS: positive(8, 720), SUPABASE_URL: z.url().refine(v => new URL(v).protocol === 'https:'),
  SUPABASE_SECRET_KEY: z.string().min(20), SUPABASE_STORAGE_BUCKET: z.string().regex(/^[a-z\d][a-z\d_-]{0,62}$/i),
  PHOTO_URL_SECONDS: positive(60, 300), STORAGE_TIMEOUT_MS: positive(15000, 30000),
});

export function loadEnv(source = process.env) {
  const result = schema.safeParse(source);
  if (!result.success) throw new Error(`Configuración inválida: ${result.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ')}`);
  return result.data;
}
