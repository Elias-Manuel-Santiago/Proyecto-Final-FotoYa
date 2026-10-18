import { attendanceRepository } from './attendance.repository.js';
import { Router } from 'express';
import { permit } from '../../security/access.js';
import { endpoint, id, period, paged, validate } from '../../shared/validation.js';
import { rateLimit } from 'express-rate-limit';
import { empty } from '../auth/auth.schemas.js';
import { kioskService } from './kiosk.service.js';
import * as kiosk from './kiosk.schemas.js';

export function attendanceRoutes() {
  const router = Router();
  const sensitive = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, skipSuccessfulRequests: true,
    standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: { code: 'RATE_LIMIT', message: 'Demasiados intentos. Probá más tarde.' } } });
  router.post('/kiosk/enter', validate(empty), endpoint(req => kioskService.enter(req.actor)));
  router.post('/kiosk/employees', validate(paged), endpoint(req => kioskService.employees(req.actor, req.input)));
  router.post('/kiosk/mark', sensitive, validate(kiosk.mark), endpoint(req => kioskService.mark(req.actor, req.input)));
  router.post('/kiosk/exit', sensitive, validate(kiosk.exit), endpoint(req => kioskService.exit(req.actor, req.input)));
  router.post('/query', permit('attendance.read'), validate(period.safeExtend({ userId: id.optional() })), endpoint(req => attendanceRepository.query(req.actor, req.input)));
  router.post('/mine', permit('attendance.self'), validate(period), endpoint(req => attendanceRepository.query(req.actor, req.input, true)));
  return router;
}
