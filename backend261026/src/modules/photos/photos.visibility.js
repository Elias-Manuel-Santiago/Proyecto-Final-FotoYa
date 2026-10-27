import { transaction } from '../../shared/transaction.js';
import { ApiError } from '../../shared/errors.js';
import { assertPermission, stationScope } from '../../security/access.js';
import { photoRepository } from './photos.repository.js';
import { requirePhotoOperator } from './photos.authorization.js';

// La visibilidad es compartida por el puesto; no cambia archivos, ventas ni conteos.
export function setPhotoVisibility(actor, input) {
  if (!['vendedor', 'encargado'].includes(actor.role)) throw new ApiError(403, 'Solo vendedores y encargados pueden ocultar fotos.');
  const permission = 'sales.create';
  assertPermission(actor, permission);
  if (actor.role === 'cliente') throw new ApiError(403, 'Solo el personal puede ocultar fotos.');
  return transaction(async connection => {
    for (const photoId of [...input.photoIds].sort()) {
      const initial = await photoRepository.find(photoId, connection);
      if (!initial) throw new ApiError(404, 'La foto no existe.');
      stationScope(actor, initial.stationId);
      const current = await requirePhotoOperator(connection, actor, permission, initial.stationId);
      if (!['vendedor', 'encargado'].includes(current.role)) throw new ApiError(403, 'Solo vendedores y encargados pueden ocultar fotos.');
      const photo = await photoRepository.find(photoId, connection, true);
      if (!photo) throw new ApiError(404, 'La foto no existe.');
      stationScope(actor, photo.stationId);
      if (photo.stationId !== initial.stationId) throw new ApiError(409, 'El puesto de la foto cambió. Volvé a intentar.');
      await connection.execute('UPDATE fotos SET oculta = ? WHERE id_fotos = ?', [input.hidden, photoId]);
    }
    return { photoIds: input.photoIds, hidden: input.hidden };
  });
}
