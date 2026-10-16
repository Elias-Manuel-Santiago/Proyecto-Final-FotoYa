import { Router } from 'express';
import { z } from 'zod';
import { permit } from '../../security/access.js';
import { endpoint, id, pagination, validate } from '../../shared/validation.js';

export function catalogRoutes(repository, stations) {
  const router = Router();
  router.post('/stations/create', permit('stations.manage'), validate(z.object({
    name: z.string().trim().min(1).max(150), address: z.string().trim().min(1).max(255),
    city: z.string().trim().min(1).max(120), event: z.string().trim().max(150).default(''),
  }).strict()), endpoint(req => stations.create(req.actor, req.input)));
  router.post('/stations/availability', permit('stations.manage'), validate(z.object({
    stationId: id, active: z.boolean(),
  }).strict()), endpoint(req => stations.setActive(req.actor, req.input)));
  router.post('/query', permit('catalog.read'), validate(z.object({ resource: z.enum(['stations', 'cities', 'events', 'roles', 'prices']), stationId: id.optional(), ...pagination }).strict()),
    endpoint(req => repository.query(req.actor, req.input)));
  return router;
}
