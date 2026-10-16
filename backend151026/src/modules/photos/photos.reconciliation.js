import { transaction } from '../../shared/transaction.js';
import { ApiError } from '../../shared/errors.js';

export async function reconcilePhotoUploads(db, storage, bucket) {
  const [pending] = await db.execute(`SELECT operation_id FROM photo_uploads WHERE id_foto IS NULL AND cleaned_at IS NULL
    AND last_attempt_at < TIMESTAMPADD(MINUTE,-5,UTC_TIMESTAMP(6)) ORDER BY created_at LIMIT 100`);
  let cleaned = 0;
  for (const { operation_id: id } of pending) {
    cleaned += await transaction(db, async connection => {
      const [[job]] = await connection.execute(`SELECT * FROM photo_uploads WHERE operation_id = ? AND id_foto IS NULL
        AND cleaned_at IS NULL AND last_attempt_at < TIMESTAMPADD(MINUTE,-5,UTC_TIMESTAMP(6)) FOR UPDATE`, [id]);
      if (!job) return 0;
      if (job.bucket !== bucket) throw new ApiError(409, 'La carga pendiente pertenece a otro bucket.');
      const [[photo]] = await connection.execute('SELECT id_fotos FROM fotos WHERE id_archivo = ?', [job.id_archivo]);
      if (photo) throw new ApiError(409, 'La carga tiene una foto vinculada y requiere revisión.');
      await storage.remove(job.id_archivo);
      await connection.execute('UPDATE photo_uploads SET cleaned_at = UTC_TIMESTAMP(6) WHERE operation_id = ?', [id]);
      return 1;
    });
  }
  return { cleaned };
}
