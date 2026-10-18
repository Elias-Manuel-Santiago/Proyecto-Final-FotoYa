import { Router } from 'express';
import { permit } from '../../security/access.js';
import { ApiError } from '../../shared/errors.js';

export function pendingRoutes() {
  const router = Router();
  for (const [path, permission] of [['/attendance/check-in', 'attendance.self'], ['/attendance/check-out', 'attendance.self']]) {
    router.post(path, permit(permission), () => { throw new ApiError(403, 'Registrá la asistencia desde la vista de check-in del encargado.', 'KIOSK_REQUIRED'); });
  }
  return router;
}
