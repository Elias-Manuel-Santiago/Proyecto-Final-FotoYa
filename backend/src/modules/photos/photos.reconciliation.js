/**
 * @file
 * Limpia objetos de reservas sin foto confirmada ni intentos recientes. Comprueba bajo bloqueo
 * el bucket y la ausencia de foto antes de eliminar.
 */
import { db } from '../../config/database.js';
import { env } from '../../config/env.js';
import { removeFile } from '../../integrations/storage.js';
import { transaction } from '../../shared/transaction.js';
import { ApiError } from '../../shared/errors.js';

// Limpia hasta cien reservas antiguas sin foto, revalidando cada una bajo bloqueo antes de borrar.
export async function reconcilePhotoUploads() {
  const [pending] = await db.execute(`SELECT operation_id FROM photo_uploads WHERE id_foto IS NULL AND cleaned_at IS NULL
    AND last_attempt_at < TIMESTAMPADD(MINUTE,-5,UTC_TIMESTAMP(6)) ORDER BY created_at LIMIT 100`);
  let cleaned = 0;
  for (const { operation_id: id } of pending) {
    cleaned += await transaction(async connection => {
      const [[job]] = await connection.execute(`SELECT * FROM photo_uploads WHERE operation_id = ? AND id_foto IS NULL
        AND cleaned_at IS NULL AND last_attempt_at < TIMESTAMPADD(MINUTE,-5,UTC_TIMESTAMP(6)) FOR UPDATE`, [id]);
      // Si hubo reintento o confirmación después de seleccionar pendientes, se omite la limpieza.
      if (!job) return 0;
      if (job.bucket !== env.SUPABASE_STORAGE_BUCKET) throw new ApiError(409, 'La carga pendiente pertenece a otro bucket.');
      const [[photo]] = await connection.execute('SELECT id_fotos FROM fotos WHERE id_archivo = ?', [job.id_archivo]);
      if (photo) throw new ApiError(409, 'La carga tiene una foto vinculada y requiere revisión.');
      await removeFile(job.id_archivo);
      await connection.execute('UPDATE photo_uploads SET cleaned_at = UTC_TIMESTAMP(6) WHERE operation_id = ?', [id]);
      return 1;
    });
  }
  return { cleaned };
}
