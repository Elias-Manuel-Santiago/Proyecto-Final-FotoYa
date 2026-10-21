import { authService } from './auth.service.js';
import { authRepository } from './auth.repository.js';
import { userService } from '../users/users.service.js';
import { authenticate } from '../../security/authenticate.js';
import { workAccess } from '../../security/work-access.js';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { endpoint, paged, validate } from '../../shared/validation.js';
import * as schema from './auth.schemas.js';
import { registrationService } from './registration.service.js';

export function authRoutes() {
  const router = Router();
  const sensitive = rateLimit({ windowMs: 15 * 60 * 1000, limit: 10, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: { code: 'RATE_LIMIT', message: 'Demasiados intentos. Probá más tarde.' } } });
  router.post('/login', sensitive, validate(schema.login), endpoint(req => authService.login(req.input)));
  router.post('/register', sensitive, validate(schema.register), endpoint(req => registrationService.register(req.input)));
  router.post('/social', sensitive, validate(schema.social), endpoint(req => registrationService.social(req.input)));
  router.post('/verification/start', sensitive, validate(schema.login), endpoint(req => registrationService.start(req.input)));
  router.post('/verification/resend', sensitive, validate(schema.challenge), endpoint(req => registrationService.resend(req.input)));
  router.post('/verification/confirm', sensitive, validate(schema.verify), endpoint(req => registrationService.verify(req.input)));
  router.use(authenticate, workAccess);
  router.post('/me', validate(schema.empty), endpoint(req => userService.profile(req.actor)));
  router.post('/logout', validate(schema.empty), endpoint(req => authRepository.revoke(req.actor, req.actor.sessionId)));
  router.post('/sessions/query', validate(paged), endpoint(req => authRepository.sessions(req.actor, req.input)));
  router.post('/sessions/revoke', validate(schema.session), endpoint(req => authRepository.revoke(req.actor, req.input.sessionId)));
  router.post('/password/change', sensitive, validate(schema.changePassword), endpoint(req => authService.changePassword(req.actor, req.input)));
  return router;
}
