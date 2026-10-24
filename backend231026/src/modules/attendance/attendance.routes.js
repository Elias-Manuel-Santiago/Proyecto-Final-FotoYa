/**
 * @file
 * Expone consultas de asistencia y operaciones del kiosco. Limita intentos con contraseña y
 * distingue historial propio de consulta administrativa.
 */
import { attendanceRepository } from './attendance.repository.js';
import { Router } from 'express';
import { permit } from '../../security/access.js';
import { endpoint, id, period, paged, validate } from '../../shared/validation.js';
import { rateLimit } from 'express-rate-limit';
import { kioskService } from './kiosk.service.js';
import * as kiosk from './kiosk.schemas.js';

// Conecta consultas y operaciones de kiosco con sus permisos y validadores.
export function attendanceRoutes() {
  const router = Router();
  const sensitive = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, skipSuccessfulRequests: true,
    standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: { code: 'RATE_LIMIT', message: 'Demasiados intentos. Probá más tarde.' } } });
  router.post('/kiosk/stations', validate(paged), endpoint(req => kioskService.stations(req.actor, req.input)));
  router.post('/kiosk/assign', sensitive, validate(kiosk.assign), endpoint(req => kioskService.assign(req.actor, req.input)));
  router.post('/kiosk/employees', validate(paged), endpoint(req => kioskService.employees(req.actor, req.input)));
  router.post('/kiosk/mark', sensitive, validate(kiosk.mark), endpoint(req => kioskService.mark(req.actor, req.input)));
  router.post('/kiosk/exit', sensitive, validate(kiosk.exit), endpoint(req => kioskService.exit(req.actor, req.input)));
  router.post('/query', permit('attendance.read'), validate(period.safeExtend({ userId: id.optional() })), endpoint(req => attendanceRepository.query(req.actor, req.input)));
  router.post('/mine', permit('attendance.self'), validate(period), endpoint(req => attendanceRepository.query(req.actor, req.input, true)));
  return router;
}
