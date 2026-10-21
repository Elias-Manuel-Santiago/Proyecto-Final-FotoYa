/**
 * @file
 * Simula fotos y asignaciones. Aísla permisos y estado de los servicios externos.
 */
import { businessDate } from '../../../src/domain/dates';
import { errorMessage, operationId } from '../../../src/domain/format';
import type {
  AppData,
  Employee,
  PhotoFile,
  UploadResult,
} from '../../../src/domain/models';
import {
  requirePermission,
  requireStation,
} from '../../../src/domain/permissions';

export function uploadPhotos(
  data: AppData,
  actor: Employee,
  stationId: string,
  files: PhotoFile[],
  now: Date,
  store: (file: PhotoFile) => string,
) {
  requirePermission(actor, 'photos.upload');
  requireStation(actor, stationId);
  if (!data.stations.some((station) => station.id === stationId))
    throw new Error('El puesto no existe.');
  const date = businessDate(now);
  return files.map((file): UploadResult => {
    try {
      if (
        data.stations.find((station) => station.id === stationId)?.active ===
        false
      )
        throw new Error(
          'El puesto está dado de baja. No se pueden cargar fotos.',
        );
      if (
        !file.uri ||
        !file.name ||
        (file.size !== undefined && file.size <= 0)
      )
        throw new Error('El archivo está vacío.');
      if (
        file.mimeType
          ? !file.mimeType.startsWith('image/')
          : !/\.(jpe?g|png|webp|heic|heif)$/i.test(file.name)
      ) {
        throw new Error('Seleccioná un archivo de imagen.');
      }
      const uri = store(file);
      if (!uri) throw new Error('No se pudo guardar la foto.');
      data.photos.push({
        id: operationId('photo'),
        operationId: file.key,
        stationId,
        employeeId: actor.id,
        date,
        name: file.name,
        uri,
        createdAt: now.toISOString(),
      });
      const count = data.counts.find(
        (row) => row.stationId === stationId && row.date === date,
      );
      if (count) count.taken += 1;
      else data.counts.push({ stationId, date, taken: 1 });
      return { key: file.key };
    } catch (error) {
      return { key: file.key, error: errorMessage(error) };
    }
  });
}
