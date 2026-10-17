import { catalogRepository } from './catalog.repository.js';
import { stations } from './stations.service.js';
import { Router } from 'express';
import { z } from 'zod';
import { permit } from '../../security/access.js';
import { endpoint, id, pagination, validate } from '../../shared/validation.js';

export function catalogRoutes() {
  const router = Router();
  router.post('/prices/create', permit('stations.manage'), validate(z.object({
    stationId: id, name: z.string().trim().min(1).max(100), amount: z.string().regex(/^\d{1,10}(\.\d{1,2})?$/),
  }).strict()), endpoint(req => stations.createPrice(req.actor, req.input)));
  router.post('/stations/create', permit('stations.manage'), validate(z.object({
    name: z.string().trim().min(1).max(150), address: z.string().trim().min(1).max(255),
    city: z.string().trim().min(1).max(120), event: z.string().trim().max(150).default(''),
  }).strict()), endpoint(req => stations.create(req.actor, req.input)));
  router.post('/stations/availability', permit('stations.manage'), validate(z.object({
    stationId: id, active: z.boolean(),
  }).strict()), endpoint(req => stations.setActive(req.actor, req.input)));
  router.post('/query', permit('catalog.read'), validate(z.object({ resource: z.enum(['stations', 'cities', 'events', 'roles', 'prices']), stationId: id.optional(), ...pagination }).strict()),
    endpoint(req => catalogRepository.query(req.actor, req.input)));
  return router;
}
