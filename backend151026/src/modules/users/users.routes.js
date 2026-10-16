import { Router } from 'express';
import { permit } from '../../security/access.js';
import { endpoint, validate } from '../../shared/validation.js';
import * as schema from './users.schemas.js';

export function userRoutes(service) {
  const router = Router();
  router.post('/query', permit('employees.read'), validate(schema.query), endpoint(req => service.query(req.actor, req.input)));
  router.post('/detail', permit('employees.read'), validate(schema.detail), endpoint(req => service.detail(req.actor, req.input.userId)));
  router.post('/create', permit('employees.manage'), validate(schema.create), endpoint(req => service.create(req.actor, req.input)));
  router.post('/update', permit('employees.manage'), validate(schema.update), endpoint(req => service.update(req.actor, req.input)));
  router.post('/availability', permit('employees.manage'), validate(schema.active), endpoint(req => service.setActive(req.actor, req.input)));
  return router;
}
