import { ApiError } from '../shared/errors.js';

export function authenticate(repository) {
  return async (req, res, next) => {
    const match = /^Bearer ([\w-]{43})$/.exec(req.headers.authorization ?? '');
    if (!match) throw new ApiError(401, 'Iniciá sesión para continuar.', 'UNAUTHENTICATED');
    const actor = await repository.actor(match[1]);
    if (!actor) throw new ApiError(401, 'La sesión venció o fue revocada.', 'UNAUTHENTICATED');
    req.actor = actor; next();
  };
}
