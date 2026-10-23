/**
 * @file
 * Lee un multipart en memoria hasta 6 MiB. Reconoce JPG, PNG y WebP por firma binaria sin
 * confiar en extensión o MIME declarado.
 */
import multer from 'multer';
import { ApiError } from '../../shared/errors.js';

export const MAX_PHOTO_BYTES = 6 * 1024 * 1024;
// Recibe un único archivo en memoria con límites antes de procesar la carga.
export function readPhoto(req, res, next) {
  multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_PHOTO_BYTES, files: 1, fields: 3, parts: 4, fieldSize: 128 } })
    .single('photo')(req, res, error => next(error ? new ApiError(error.code === 'LIMIT_FILE_SIZE' ? 413 : 422,
      error.code === 'LIMIT_FILE_SIZE' ? 'La foto supera los 6 MB.' : 'Formulario de foto inválido.', 'INVALID_PHOTO') : undefined));
}

// Reconoce JPEG, PNG o WebP por sus bytes y rechaza contenido no admitido.
export function photoFormat(file) {
  const bytes = file?.buffer;
  if (!bytes?.length || bytes.length > MAX_PHOTO_BYTES) throw new ApiError(422, 'Adjuntá una foto de hasta 6 MB.', 'INVALID_PHOTO');
  if (bytes.length >= 8 && bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) return { extension: 'png', mime: 'image/png' };
  if (bytes.length >= 3 && bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return { extension: 'jpg', mime: 'image/jpeg' };
  if (bytes.length >= 12 && bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') return { extension: 'webp', mime: 'image/webp' };
  throw new ApiError(422, 'El contenido debe ser JPG, PNG o WebP.', 'INVALID_PHOTO');
}
