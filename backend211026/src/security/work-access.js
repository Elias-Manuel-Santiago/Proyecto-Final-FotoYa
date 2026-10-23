/**
 * @file
 * Bloquea operaciones en modo kiosco o sin jornada para los roles que la requieren. También
 * protege peticiones directas y sesiones en otros dispositivos.
 */
import { ApiError } from '../shared/errors.js';

// Determina qué roles necesitan registrar entrada para operar.
export const requiresAttendance = role => ['secretario', 'camarografo', 'vendedor'].includes(role);

// Se aplica también a peticiones directas y a sesiones abiertas en otros dispositivos.
// Restringe las rutas según kiosco y jornada después de autenticar al actor.
export function workAccess(req, res, next) {
  const auth = req.baseUrl === '/api/auth';
  if (req.actor.kioskMode) {
    if ((auth && req.path === '/me') || (!auth && req.path.startsWith('/attendance/kiosk/'))) return next();
    throw new ApiError(403, 'Ingresá la contraseña del encargado para salir de la vista de check-in.', 'KIOSK_LOCKED');
  }
  if (!auth && requiresAttendance(req.actor.role) && !req.actor.working)
    throw new ApiError(403, 'Registrá tu check-in en el puesto para poder trabajar.', 'CHECK_IN_REQUIRED');
  next();
}
