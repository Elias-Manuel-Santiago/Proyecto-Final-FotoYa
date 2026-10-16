import { transaction } from '../../shared/transaction.js';
import { ApiError } from '../../shared/errors.js';
import { stationScope } from '../../security/access.js';
import { requireClient, requirePhotoOperator } from './photos.authorization.js';

export function createPhotoAssignmentService(db, repository) {
  return {
    assign(actor, input) {
      return transaction(db, async connection => {
        const initial = await repository.find(input.photoId, connection);
        if (!initial) throw new ApiError(404, 'La foto no existe.');
        stationScope(actor, initial.stationId);
        await requirePhotoOperator(connection, actor, 'photos.assign', initial.stationId);
        const photo = await repository.find(input.photoId, connection, true);
        if (!photo) throw new ApiError(404, 'La foto no existe.');
        stationScope(actor, photo.stationId);
        await requireClient(connection, input.clientId);
        if (photo.clientId && photo.clientId !== input.clientId)
          throw new ApiError(409, 'La foto ya está asignada a otro cliente.', 'PHOTO_ALREADY_ASSIGNED');
        await connection.execute('UPDATE fotos SET id_cliente = ? WHERE id_fotos = ?', [input.clientId, input.photoId]);
        const { file, ...metadata } = await repository.find(input.photoId, connection);
        return metadata;
      });
    },
  };
}
