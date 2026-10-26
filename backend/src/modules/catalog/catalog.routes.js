/**
 * @file
 * Publica catálogos y operaciones de puestos/tarifas. Los contratos y permisos distinguen
 * lectura general de administración.
 */
import { catalogRepository } from './catalog.repository.js';
import { stations } from './stations.service.js';
import { locations } from './locations.service.js';
import { pricesService } from './prices.service.js';
import { Router } from 'express';
import { z } from 'zod';
import { permit } from '../../security/access.js';
import { endpoint, id, pagination, validate } from '../../shared/validation.js';

// Valida consultas y cambios de puestos/tarifas antes de delegarlos a las capas de datos.
export function catalogRoutes() {
  const router = Router();
  const name = z.string().trim().min(1).max(150);
  const ids = z.array(id).max(10000).refine(values => new Set(values).size === values.length, 'No repitas asociaciones.');
  router.post('/cities/save', permit('stations.manage'), validate(z.object({
    id: id.optional(), name: z.string().trim().min(1).max(120),
    eventCities: z.array(z.object({ eventId: id, cityId: id.nullable() }).strict()).max(10000).default([]),
  }).strict()), endpoint(req => locations.saveCity(req.actor, req.input)));
  router.post('/events/save', permit('stations.manage'), validate(z.object({
    id: id.optional(), name, cityId: id, stationIds: ids,
  }).strict()), endpoint(req => locations.saveEvent(req.actor, req.input)));
  router.post('/locations/delete', permit('stations.manage'), validate(z.object({ kind: z.enum(['city', 'event']), id }).strict()), endpoint(req => locations.delete(req.actor, req.input)));
  router.post('/stations/update', permit('stations.manage'), validate(z.object({
    stationId: id, name, address: z.string().trim().min(1).max(255), cityId: id, eventId: id.nullable(),
    employeeStations: z.array(z.object({ employeeId: id, stationId: id }).strict()).max(10000)
      .refine(values => new Set(values.map(row => row.employeeId)).size === values.length, 'No repitas empleados.'),
  }).strict()), endpoint(req => locations.updateStation(req.actor, req.input)));
  const priceFields = {
    stationId: id, name: z.string().trim().min(1).max(100), amount: z.string().regex(/^\d{1,10}(\.\d{1,2})?$/),
  };
  router.post('/prices/query', permit('prices.manage'), validate(z.object({ stationId: id, ...pagination }).strict()), endpoint(req => pricesService.query(req.actor, req.input)));
  router.post('/prices/create', permit('prices.manage'), validate(z.object(priceFields).strict()), endpoint(req => pricesService.create(req.actor, req.input)));
  router.post('/prices/update', permit('prices.manage'), validate(z.object({ ...priceFields, priceId: id }).strict()), endpoint(req => pricesService.update(req.actor, req.input)));
  router.post('/prices/availability', permit('prices.manage'), validate(z.object({ stationId: id, priceId: id, active: z.boolean() }).strict()), endpoint(req => pricesService.setActive(req.actor, req.input)));
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
