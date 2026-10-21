/**
 * @file
 * Resuelve el Bearer contra sesiones y usuarios vigentes. Deja en req.actor identidad,
 * permisos, jornada y modo kiosco para las siguientes capas.
 */
import { authRepository } from '../modules/auth/auth.repository.js';
import { ApiError } from '../shared/errors.js';

// Resuelve el Bearer en una sesión vigente y entrega req.actor a las siguientes capas.
export async function authenticate(req, res, next) {
  const match = /^Bearer ([\w-]{43})$/.exec(req.headers.authorization ?? '');
  if (!match) throw new ApiError(401, 'Iniciá sesión para continuar.', 'UNAUTHENTICATED');
  const actor = await authRepository.actor(match[1]);
  if (!actor) throw new ApiError(401, 'La sesión venció o fue revocada.', 'UNAUTHENTICATED');
  req.actor = actor; next();
}
