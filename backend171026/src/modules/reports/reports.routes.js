import { reportsRepository } from './reports.repository.js';
import { Router } from 'express';
import { permit } from '../../security/access.js';
import { endpoint, id, period, validate } from '../../shared/validation.js';

export function reportsRoutes() {
  const router = Router();
  router.post('/query', permit('reports.read'), validate(period.safeExtend({ cityId: id.optional(), eventId: id.optional() })), endpoint(req => reportsRepository.query(req.actor, req.input)));
  router.post('/summary', permit('reports.read'), validate(period.safeExtend({ cityId: id.optional(), eventId: id.optional() })), endpoint(req => reportsRepository.summary(req.actor, req.input)));
  router.post('/days/query', permit('counts.read'), validate(period), endpoint(req => reportsRepository.days(req.actor, req.input)));
  return router;
}
