/**
 * @file
 * Autoriza metadatos y vistas previas por cliente o alcance del personal. Omite la ruta
 * interna del archivo en los detalles públicos.
 */
import { photoRepository } from './photos.repository.js';
import { signedPreviewUrl } from '../../integrations/storage.js';
import { ApiError } from '../../shared/errors.js';
import { globalScope, stationScope } from '../../security/access.js';

// Oculta fotos inexistentes o fuera del alcance antes de devolver su ruta interna.
const find = async (actor, photoId) => {
  const row = await photoRepository.find(photoId);
  const allowed = row && (actor.role === 'cliente' ? row.clientId === actor.id
    : globalScope(actor) || actor.stationId && row.stationId === actor.stationId);
  if (!allowed) throw new ApiError(404, 'La foto no existe.');
  return row;
};
export const photoService = {
  // Aplica alcance por puesto o propietario y delega la búsqueda de metadatos.
  query(actor, input) {
    if (actor.role === 'cliente' && input.unassigned) throw new ApiError(403, 'Las fotos sin asignar no son visibles para clientes.');
    if (actor.role === 'cliente' && input.clientId && input.clientId !== actor.id) throw new ApiError(403, 'Solo podés consultar tus fotos.');
    return photoRepository.query(actor, input, actor.role === 'cliente' ? null : stationScope(actor, input.stationId));
  },
  // Devuelve datos de la foto autorizada excluyendo la ruta privada del archivo.
  async detail(actor, photoId) {
    const { file, ...metadata } = await find(actor, photoId);
    return metadata;
  },
  // Autoriza la foto antes de pedir la URL temporal de su previsualización.
  async access(actor, photoId) { return signedPreviewUrl((await find(actor, photoId)).file); },
};
