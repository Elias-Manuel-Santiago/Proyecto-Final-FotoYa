import { salesRepository } from './sales.repository.js';
import { salesService } from './sales.service.js';
import { saleInput, salePhotosInput } from './sales.schemas.js';
import { Router } from 'express';
import { z } from 'zod';
import { permit } from '../../security/access.js';
import { endpoint, id, period, validate } from '../../shared/validation.js';

export function salesRoutes() {
  const router = Router();
  const station = z.object({ stationId: id }).strict();
  router.post('/create', permit('sales.create'), validate(saleInput), endpoint(req => salesService.create(req.actor, req.input)));
  router.post('/event', permit('sales.create'), validate(station), endpoint(req => salesService.event(req.actor, req.input)));
  router.post('/event/set', permit('sales.create'), validate(z.object({ stationId: id, open: z.boolean() }).strict()), endpoint(req => salesService.setEvent(req.actor, req.input)));
  router.post('/photos', permit('sales.create'), validate(salePhotosInput), endpoint(req => salesService.photos(req.actor, req.input)));
  router.post('/photos/access', permit('sales.create'), validate(z.object({ photoId: id }).strict()), endpoint(req => salesService.accessPhoto(req.actor, req.input.photoId)));
  router.use(permit('sales.read'));
  router.post('/query', validate(period), endpoint(req => salesRepository.query(req.actor, req.input)));
  router.post('/detail', validate(z.object({ saleId: id }).strict()), endpoint(req => salesRepository.detail(req.actor, req.input.saleId)));
  return router;
}
