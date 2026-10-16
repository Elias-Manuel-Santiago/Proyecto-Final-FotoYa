import { Router } from 'express';
import { permit } from '../../security/access.js';
import { endpoint, id, period, validate } from '../../shared/validation.js';

export function reportsRoutes(repository) {
  const router = Router();
  router.post('/query', permit('reports.read'), validate(period.safeExtend({ cityId: id.optional(), eventId: id.optional() })), endpoint(req => repository.query(req.actor, req.input)));
  router.post('/summary', permit('reports.read'), validate(period.safeExtend({ cityId: id.optional(), eventId: id.optional() })), endpoint(req => repository.summary(req.actor, req.input)));
  router.post('/days/query', permit('counts.read'), validate(period), endpoint(req => repository.days(req.actor, req.input)));
  return router;
}
