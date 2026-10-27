/**
 * @file
 * Aplica permisos, alcance por puesto y restricciones de asignación de roles. Tener alcance
 * global no reemplaza el permiso requerido por una ruta.
 */
import { ApiError } from '../shared/errors.js';

// Identifica actores con alcance sobre varios puestos; cada ruta exige además su permiso.
export const globalScope = actor => ['dueno', 'secretario'].includes(actor.role);
// Interrumpe la operación si el permiso no figura entre los permisos efectivos del actor.
export function assertPermission(actor, permission) {
  if ((actor.role === 'secretario' && permission.startsWith('attendance.')) || !actor.permissions.includes(permission)) throw new ApiError(403, 'No tenés permiso para esta operación.', 'FORBIDDEN');
}
// Adapta la comprobación de permisos a la cadena de middlewares de Express.
export const permit = permission => (req, res, next) => {
  try { assertPermission(req.actor, permission); next(); } catch (error) { next(error); }
};
// Resuelve el puesto efectivo y rechaza pedidos fuera del puesto asignado.
export function stationScope(actor, requested) {
  if (globalScope(actor)) return requested ?? null;
  if (!actor.stationId || (requested && requested !== actor.stationId)) throw new ApiError(403, 'El puesto está fuera de tu alcance.', 'FORBIDDEN');
  return actor.stationId;
}
// Limita los roles y puestos que el actor puede asignar a otro usuario.
export function assertAssignable(actor, role, stationId) {
  if (actor.role === 'dueno') return;
  if (!['encargado', 'editor', 'camarografo', 'vendedor'].includes(role) || stationId !== actor.stationId)
    throw new ApiError(403, 'No podés asignar ese rol o puesto.', 'FORBIDDEN');
}
