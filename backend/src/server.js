import { createApp } from './app.js';
import { env } from './config/env.js';
import { db } from './config/database.js';

try {
  const [[row]] = await db.query("SELECT COUNT(*) AS count FROM usuarios WHERE nombre LIKE 'enc:v1:%' OR apellido LIKE 'enc:v1:%' OR email LIKE 'enc:v1:%' OR dni LIKE 'enc:v1:%' OR password NOT LIKE 'scrypt$%'");
  if (Number(row.count)) throw new Error('Ejecutá npm run db:migrate para actualizar los datos y hashear las contraseñas.');
  const app = createApp();
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
