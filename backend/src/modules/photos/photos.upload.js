import { randomUUID } from 'node:crypto';
import { transaction } from '../../shared/transaction.js';
import { ApiError } from '../../shared/errors.js';
import { stationScope } from '../../security/access.js';
import { photoFormat } from './photos.files.js';
import { requireClient, requirePhotoOperator } from './photos.authorization.js';

export const businessDate = now => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(now);

export function createPhotoUploadService(db, repository, storage, env, now = () => new Date()) {
  return {
    async upload(actor, input, file) {
      stationScope(actor, input.stationId);
      const format = photoFormat(file), bucket = env.SUPABASE_STORAGE_BUCKET;
      const requestData = JSON.stringify([input.stationId, input.clientId, file.buffer.toString('base64'), bucket]);
      const path = `${input.stationId}/${randomUUID()}.${format.extension}`;
      // La reserva persiste aunque falle Storage o se pierda la confirmación de COMMIT.
      await db.execute(`INSERT INTO photo_uploads (operation_id,id_actor,id_puesto,request_data,bucket,id_archivo)
        VALUES (?,?,?,?,?,?) ON DUPLICATE KEY UPDATE
        last_attempt_at = IF(id_actor = VALUES(id_actor) AND request_data = VALUES(request_data), UTC_TIMESTAMP(6), last_attempt_at),
        cleaned_at = IF(id_actor = VALUES(id_actor) AND request_data = VALUES(request_data), NULL, cleaned_at)`,
      [input.operationId, actor.id, input.stationId, requestData, bucket, path]);
      return transaction(db, async connection => {
        await requirePhotoOperator(connection, actor, 'photos.upload', input.stationId);
        const [[job]] = await connection.execute('SELECT * FROM photo_uploads WHERE operation_id = ? FOR UPDATE', [input.operationId]);
        if (job.id_actor !== actor.id || job.request_data !== requestData)
          throw new ApiError(409, 'La operación ya se usó con otros datos.', 'IDEMPOTENCY_CONFLICT');
        if (job.id_foto) {
          const { file: storedFile, ...metadata } = await repository.find(job.id_foto, connection);
          return metadata;
        }
        const [[station]] = await connection.execute('SELECT disponible AS active FROM puesto WHERE id_puesto = ? LOCK IN SHARE MODE', [input.stationId]);
        if (!station?.active) throw new ApiError(409, 'El puesto está dado de baja. No se pueden cargar fotos.');
        if (input.clientId !== null) await requirePhotoOperator(connection, actor, 'photos.assign', input.stationId);
        await requireClient(connection, input.clientId);
        // Sólo se limpia el objeto de esta reserva sin foto confirmada, bajo bloqueo.
        await storage.remove(job.id_archivo);
        await storage.upload(job.id_archivo, file.buffer, format.mime);
        const date = businessDate(now());
        await connection.execute('INSERT INTO dias (fecha,id_puesto) VALUES (?,?) ON DUPLICATE KEY UPDATE id_dias = id_dias', [date, input.stationId]);
        const [[day]] = await connection.execute('SELECT id_dias,fotos FROM dias WHERE fecha = ? AND id_puesto = ? FOR UPDATE', [date, input.stationId]);
        const [[sales]] = await connection.execute('SELECT COALESCE(SUM(cantidad),0) AS sold FROM venta WHERE id_dias = ?', [day.id_dias]);
        const taken = Number(day.fotos) + 1, discarded = taken - Number(sales.sold);
        if (discarded < 0 || taken > 4294967295) throw new ApiError(409, 'Los conteos del día requieren revisión.', 'INVALID_COUNTS');
        const [photo] = await connection.execute('INSERT INTO fotos (id_archivo,id_dia,id_cliente,id_puesto) VALUES (?,?,?,?)',
          [job.id_archivo, day.id_dias, input.clientId, input.stationId]);
        await connection.execute('UPDATE dias SET fotos = ?, descartes = ? WHERE id_dias = ?', [taken, discarded, day.id_dias]);
        await connection.execute('UPDATE photo_uploads SET id_foto = ? WHERE operation_id = ?', [photo.insertId, input.operationId]);
        const { file: storedFile, ...metadata } = await repository.find(String(photo.insertId), connection);
        return metadata;
      });
    },
  };
}
