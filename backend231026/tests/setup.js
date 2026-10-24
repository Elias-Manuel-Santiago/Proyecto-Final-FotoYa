/**
 * @file
 * Configura variables aisladas antes de importar el backend. Evita heredar credenciales del
 * entorno real.
 */
// Las pruebas no toman las credenciales del .env real.
Object.assign(process.env, {
  DATA_ENCRYPTION_KEY: 'ab'.repeat(32),
  NODE_ENV: 'test', CORS_ORIGINS: 'http://localhost:8081', DB_HOST: '127.0.0.1',
  DB_PORT: '3306', DB_NAME: 'foto_ya_test', DB_USER: 'root', DB_PASSWORD: '',
  DB_CONNECTION_LIMIT: '2', DB_IDLE_TIMEOUT_MS: '10000',
  SUPABASE_URL: 'https://example.supabase.co',
  SUPABASE_SECRET_KEY: 'sb_secret_test-not-for-production', SUPABASE_STORAGE_BUCKET: 'foto-ya',
  PHOTO_URL_SECONDS: '60', SESSION_HOURS: '8', STORAGE_TIMEOUT_MS: '15000',
});
process.env.DB_SSL_CA_PATH = ''; // Evita que dotenv lo complete con el archivo real.
