/**
 * @file
 * Publica conteos diarios, informes y resumen del período. Distingue permisos de
 * conteos/informes y valida filtros inclusivos.
 */
import { reportsRepository } from './reports.repository.js';
import { Router } from 'express';
import { permit } from '../../security/access.js';
import { endpoint, id, period, validate } from '../../shared/validation.js';
import { z } from 'zod';
import { graphicsRepository } from './graphics.repository.js';

export const graphicsQuery = period.safeExtend({ day: z.iso.date().optional() })
  .refine(v => !v.day || (v.day >= v.from && v.day <= v.to), 'El día debe pertenecer al período.');

// Separa permisos de conteos e informes y valida filtros antes de consultar.
export function reportsRoutes() {
  const router = Router();
  router.post('/graphics/query', permit('reports.read'), validate(graphicsQuery), endpoint(req => graphicsRepository.query(req.actor, req.input)));
  router.post('/query', permit('reports.read'), validate(period.safeExtend({ cityId: id.optional(), eventId: id.optional() })), endpoint(req => reportsRepository.query(req.actor, req.input)));
  router.post('/summary', permit('reports.read'), validate(period.safeExtend({ cityId: id.optional(), eventId: id.optional() })), endpoint(req => reportsRepository.summary(req.actor, req.input)));
  router.post('/days/query', permit('counts.read'), validate(period), endpoint(req => reportsRepository.days(req.actor, req.input)));
  return router;
}
