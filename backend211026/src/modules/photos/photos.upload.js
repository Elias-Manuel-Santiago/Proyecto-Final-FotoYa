/**
 * @file
 * Sube una foto y confirma sus metadatos y conteos en una transacción. Ante un fallo intenta
 * retirar únicamente el archivo nuevo si no quedó registrado.
 */
import { db } from '../../config/database.js';
import { photoRepository } from './photos.repository.js';
import { uploadFile, removeFile } from '../../integrations/storage.js';
import { randomUUID } from 'node:crypto';
import { transaction } from '../../shared/transaction.js';
import { ApiError } from '../../shared/errors.js';
import { stationScope } from '../../security/access.js';
import { photoFormat } from './photos.files.js';
import { requireClient, requirePhotoOperator } from './photos.authorization.js';

// Asigna la carga al día argentino independientemente del huso horario del servidor.
export const businessDate = now => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Argentina/Buenos_Aires' }).format(now);

export const photoUploads = {
  // Cada solicitud es una carga independiente, sin reservas ni copias del archivo en MySQL.
  async upload(actor, input, file) {
    stationScope(actor, input.stationId);
    const format = photoFormat(file);
    const path = `${input.stationId}/${randomUUID()}.${format.extension}`;
    let uploadAttempted = false;
    try {
      return await transaction(async connection => {
        await requirePhotoOperator(connection, actor, 'photos.upload', input.stationId);
        const [[station]] = await connection.execute('SELECT disponible AS active FROM puesto WHERE id_puesto = ? LOCK IN SHARE MODE', [input.stationId]);
        if (!station?.active) throw new ApiError(409, 'El puesto está dado de baja. No se pueden cargar fotos.');
        if (input.clientId !== null) await requirePhotoOperator(connection, actor, 'photos.assign', input.stationId);
        await requireClient(connection, input.clientId);
        // Un timeout de Storage puede ocurrir después de guardar el archivo: también se limpia.
        uploadAttempted = true;
        await uploadFile(path, file.buffer, format.mime);
        // El día se calcula al confirmar la carga y sus conteos se actualizan bajo el mismo bloqueo.
        const date = businessDate(new Date());
        await connection.execute('INSERT INTO dias (fecha,id_puesto) VALUES (?,?) ON DUPLICATE KEY UPDATE id_dias = id_dias', [date, input.stationId]);
        const [[day]] = await connection.execute('SELECT id_dias,fotos FROM dias WHERE fecha = ? AND id_puesto = ? FOR UPDATE', [date, input.stationId]);
        const [[sales]] = await connection.execute('SELECT COALESCE(SUM(IF(familia_contada, cantidad, 0)),0) AS sold FROM venta WHERE id_dias = ?', [day.id_dias]);
        // Cada foto suma una familia; los descartes se derivan de las familias compradoras del día.
        const taken = Number(day.fotos) + 1, discarded = taken - Number(sales.sold);
        if (discarded < 0 || taken > 4294967295) throw new ApiError(409, 'Los conteos del día requieren revisión.', 'INVALID_COUNTS');
        const [photo] = await connection.execute('INSERT INTO fotos (id_archivo,id_dia,id_cliente,id_puesto) VALUES (?,?,?,?)',
          [path, day.id_dias, input.clientId, input.stationId]);
        await connection.execute('UPDATE dias SET fotos = ?, descartes = ? WHERE id_dias = ?', [taken, discarded, day.id_dias]);
        const { file: storedFile, ...metadata } = await photoRepository.find(String(photo.insertId), connection);
        return metadata;
      });
    } catch (error) {
      if (uploadAttempted) {
        try {
          // Si COMMIT se confirmó pero se perdió su respuesta, conservar la foto registrada.
          const [[saved]] = await db.execute('SELECT id_fotos FROM fotos WHERE id_archivo = ?', [path]);
          if (!saved) await removeFile(path);
        } catch {
          // No ocultar el error original ni borrar a ciegas si MySQL no permite comprobarlo.
          console.warn('No se pudo completar la limpieza de una carga fallida.');
        }
      }
      throw error;
    }
  },
};
