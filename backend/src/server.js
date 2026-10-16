import { createApp } from './app.js';
import { loadEnv } from './config/env.js';
import { createDatabase } from './config/database.js';

const env = loadEnv(), db = createDatabase(env);
try {
  const [[row]] = await db.query("SELECT COUNT(*) AS count FROM usuarios WHERE email_hash IS NULL OR dni_hash IS NULL OR nombre NOT LIKE 'enc:v1:%' OR apellido NOT LIKE 'enc:v1:%' OR email NOT LIKE 'enc:v1:%' OR dni NOT LIKE 'enc:v1:%' OR password NOT LIKE 'scrypt$%'");
  if (Number(row.count)) throw new Error('Ejecutá npm run db:migrate para proteger los datos personales.');
  const app = await createApp({ db, env });
  const server = app.listen(env.PORT, env.HOST, () => console.log(`Foto Ya disponible en http://${env.HOST}:${env.PORT}`));
  const stop = () => {
    server.close(async () => { await db.end(); process.exit(0); });
    setTimeout(() => process.exit(1), 10000).unref();
  };
  process.once('SIGTERM', stop); process.once('SIGINT', stop);
} catch (error) {
  console.error({ code: error.code ?? 'STARTUP_ERROR', message: error.code ? 'Revisá la conexión y las migraciones de MySQL.' : error.message });
  await db.end(); process.exitCode = 1;
}
