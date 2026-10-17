import { salesRepository } from './sales.repository.js';
import { Router } from 'express';
import { z } from 'zod';
import { permit } from '../../security/access.js';
import { endpoint, id, period, validate } from '../../shared/validation.js';

export function salesRoutes() {
  const router = Router();
  router.use(permit('sales.read'));
  router.post('/query', validate(period), endpoint(req => salesRepository.query(req.actor, req.input)));
  router.post('/detail', validate(z.object({ saleId: id }).strict()), endpoint(req => salesRepository.detail(req.actor, req.input.saleId)));
  return router;
}
