import { photoService } from './photos.service.js';
import { photoAssignments } from './photos.assignment.js';
import { photoUploads } from './photos.upload.js';
import { Router } from 'express';
import { rateLimit } from 'express-rate-limit';
import { permit } from '../../security/access.js';
import { endpoint, validate } from '../../shared/validation.js';
import { readPhoto } from './photos.files.js';
import * as schema from './photos.schemas.js';

export function photoRoutes() {
  const router = Router(), detail = validate(schema.detail);
  router.post('/query', permit('photos.read'), validate(schema.query), endpoint(req => photoService.query(req.actor, req.input)));
  router.post('/detail', permit('photos.read'), detail, endpoint(req => photoService.detail(req.actor, req.input.photoId)));
  router.post('/access', permit('photos.read'), detail, endpoint(req => photoService.access(req.actor, req.input.photoId)));
  router.post('/assign', permit('photos.assign'), validate(schema.assign), endpoint(req => photoAssignments.assign(req.actor, req.input)));
  router.post('/upload', permit('photos.upload'), rateLimit({ windowMs: 60000, limit: 20, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: { code: 'RATE_LIMIT', message: 'Demasiadas cargas. Probá más tarde.' } } }), readPhoto, validate(schema.upload),
  endpoint(req => photoUploads.upload(req.actor, req.input, req.file)));
  return router;
}
