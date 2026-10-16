import { loadEnv } from '../src/config/env.js';

export const env = loadEnv({
  NODE_ENV: 'test', CORS_ORIGINS: 'http://localhost:8081', DB_HOST: '127.0.0.1', DB_NAME: 'foto_ya_test',
  DB_USER: 'root', DB_PASSWORD: '',
  SUPABASE_URL: 'https://example.supabase.co', SUPABASE_SECRET_KEY: 'sb_secret_test-not-for-production', SUPABASE_STORAGE_BUCKET: 'foto-ya',
});
export const actor = (role, overrides = {}) => ({ id: '1', role, stationId: '10', permissions: [], ...overrides });
