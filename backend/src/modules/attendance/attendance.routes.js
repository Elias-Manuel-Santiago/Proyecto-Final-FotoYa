import { Router } from 'express';
import { permit } from '../../security/access.js';
import { endpoint, id, period, validate } from '../../shared/validation.js';

export function attendanceRoutes(repository) {
  const router = Router();
  router.post('/query', permit('attendance.read'), validate(period.safeExtend({ userId: id.optional() })), endpoint(req => repository.query(req.actor, req.input)));
  router.post('/mine', permit('attendance.self'), validate(period), endpoint(req => repository.query(req.actor, req.input, true)));
  return router;
}
