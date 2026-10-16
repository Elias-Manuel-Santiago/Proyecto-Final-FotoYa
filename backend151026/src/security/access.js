import { ApiError } from '../shared/errors.js';

export const globalScope = actor => ['dueno', 'secretario'].includes(actor.role);
export function assertPermission(actor, permission) {
  if (!actor.permissions.includes(permission)) throw new ApiError(403, 'No tenés permiso para esta operación.', 'FORBIDDEN');
}
export const permit = permission => (req, res, next) => {
  try { assertPermission(req.actor, permission); next(); } catch (error) { next(error); }
};
export function stationScope(actor, requested) {
  if (globalScope(actor)) return requested ?? null;
  if (!actor.stationId || (requested && requested !== actor.stationId)) throw new ApiError(403, 'El puesto está fuera de tu alcance.', 'FORBIDDEN');
  return actor.stationId;
}
export function assertAssignable(actor, role, stationId) {
  if (actor.role === 'dueno') return;
  if (!['encargado', 'camarografo', 'vendedor'].includes(role) || stationId !== actor.stationId)
    throw new ApiError(403, 'No podés asignar ese rol o puesto.', 'FORBIDDEN');
}
