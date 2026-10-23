/**
 * @file
 * Reserva una conexión para una unidad de trabajo. Confirma el resultado, revierte ante
 * errores y siempre devuelve la conexión al pool.
 */
import { db } from '../config/database.js';

// Ejecuta el callback en una conexión; confirma o revierte antes de liberarla.
export async function transaction(callback) {
  const connection = await db.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback().catch(() => {});
    throw error;
  } finally { connection.release(); }
}
