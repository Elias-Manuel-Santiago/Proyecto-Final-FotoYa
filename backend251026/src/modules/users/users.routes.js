/**
 * @file
 * Expone consulta, detalle, alta, edición y disponibilidad de usuarios. Aplica permisos y
 * esquemas antes de llamar al servicio.
 */
import { userService } from './users.service.js';
import { Router } from 'express';
import { permit } from '../../security/access.js';
import { endpoint, validate } from '../../shared/validation.js';
import * as schema from './users.schemas.js';

// Asocia cada operación con su permiso y contrato de entrada.
export function userRoutes() {
  const router = Router();
  router.post('/auth0/query', permit('employees.read'), validate(schema.auth0Query), endpoint(req => userService.auth0Users(req.actor)));
  router.post('/query', permit('employees.read'), validate(schema.query), endpoint(req => userService.query(req.actor, req.input)));
  router.post('/detail', permit('employees.read'), validate(schema.detail), endpoint(req => userService.detail(req.actor, req.input.userId)));
  router.post('/create', permit('employees.manage'), validate(schema.create), endpoint(req => userService.create(req.actor, req.input)));
  router.post('/update', permit('employees.manage'), validate(schema.update), endpoint(req => userService.update(req.actor, req.input)));
  router.post('/availability', permit('employees.manage'), validate(schema.active), endpoint(req => userService.setActive(req.actor, req.input)));
  return router;
}
