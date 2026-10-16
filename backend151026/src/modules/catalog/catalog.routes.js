import { Router } from 'express';
import { z } from 'zod';
import { permit } from '../../security/access.js';
import { endpoint, id, pagination, validate } from '../../shared/validation.js';

export function catalogRoutes(repository) {
  const router = Router();
  router.post('/query', permit('catalog.read'), validate(z.object({ resource: z.enum(['stations', 'cities', 'events', 'roles', 'prices']), stationId: id.optional(), ...pagination }).strict()),
    endpoint(req => repository.query(req.actor, req.input)));
  return router;
}
