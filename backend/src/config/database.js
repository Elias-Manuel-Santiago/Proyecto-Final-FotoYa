import mysql from 'mysql2/promise';
import { readFileSync } from 'node:fs';

export function createDatabase(env) {
  const pool = mysql.createPool({
    host: env.DB_HOST, port: env.DB_PORT, database: env.DB_NAME,
    user: env.DB_USER, password: env.DB_PASSWORD, connectionLimit: env.DB_CONNECTION_LIMIT,
    // mysql2 only starts idle cleanup when maxIdle is below connectionLimit.
    // Include the one-connection case so an idle Render process releases its slot.
    maxIdle: Math.min(1, env.DB_CONNECTION_LIMIT - 1), idleTimeout: env.DB_IDLE_TIMEOUT_MS,
    waitForConnections: true, queueLimit: 100, timezone: 'Z', dateStrings: true,
    supportBigNumbers: true, bigNumberStrings: true,
    ...(env.DB_SSL_CA_PATH ? { ssl: { ca: readFileSync(env.DB_SSL_CA_PATH), rejectUnauthorized: true } } : {}),
  });
  pool.on('connection', connection => connection.query("SET time_zone = '+00:00'"));
  return pool;
}
