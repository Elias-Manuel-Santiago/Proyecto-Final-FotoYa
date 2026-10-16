import { ApiError } from '../../shared/errors.js';
import { globalScope, stationScope } from '../../security/access.js';

export function createPhotoService(repository, storage) {
  const find = async (actor, photoId) => {
    const row = await repository.find(photoId);
    const allowed = row && (actor.role === 'cliente' ? row.clientId === actor.id
      : globalScope(actor) || actor.stationId && row.stationId === actor.stationId);
    if (!allowed) throw new ApiError(404, 'La foto no existe.');
    return row;
  };
  return {
    query(actor, input) {
      if (actor.role === 'cliente' && input.unassigned) throw new ApiError(403, 'Las fotos sin asignar no son visibles para clientes.');
      if (actor.role === 'cliente' && input.clientId && input.clientId !== actor.id) throw new ApiError(403, 'Solo podés consultar tus fotos.');
      return repository.query(actor, input, actor.role === 'cliente' ? null : stationScope(actor, input.stationId));
    },
    async detail(actor, photoId) {
      const { file, ...metadata } = await find(actor, photoId);
      return metadata;
    },
    async access(actor, photoId) { return storage.signedUrl((await find(actor, photoId)).file); },
  };
}
