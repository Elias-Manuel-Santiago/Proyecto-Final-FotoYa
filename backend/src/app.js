import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import { authenticate as authentication } from './security/authenticate.js';
import { createStorage } from './integrations/storage.js';
import { ApiError, errorHandler } from './shared/errors.js';
import { createAuthRepository } from './modules/auth/auth.repository.js';
import { createAuthService } from './modules/auth/auth.service.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { createUserRepository } from './modules/users/users.repository.js';
import { createUserService } from './modules/users/users.service.js';
import { userRoutes } from './modules/users/users.routes.js';
import { createPhotoRepository } from './modules/photos/photos.repository.js';
import { createPhotoService } from './modules/photos/photos.service.js';
import { createPhotoAssignmentService } from './modules/photos/photos.assignment.js';
import { createPhotoUploadService } from './modules/photos/photos.upload.js';
import { photoRoutes } from './modules/photos/photos.routes.js';
import { createSalesRepository } from './modules/sales/sales.repository.js';
import { salesRoutes } from './modules/sales/sales.routes.js';
import { createAttendanceRepository } from './modules/attendance/attendance.repository.js';
import { attendanceRoutes } from './modules/attendance/attendance.routes.js';
import { createReportsRepository } from './modules/reports/reports.repository.js';
import { reportsRoutes } from './modules/reports/reports.routes.js';
import { createCatalogRepository } from './modules/catalog/catalog.repository.js';
import { catalogRoutes } from './modules/catalog/catalog.routes.js';
import { pendingRoutes } from './modules/pending/pending.routes.js';

export async function createApp({ db, env, storage = createStorage(env) }) {
  const authRepository = createAuthRepository(db);
  const authenticate = authentication(authRepository);
  const userService = createUserService(db, createUserRepository(db));
  const photoRepository = createPhotoRepository(db);
  const authService = await createAuthService(db, authRepository, env);
  const app = express();
  app.disable('x-powered-by'); app.set('trust proxy', env.TRUST_PROXY);
  app.use((req, res, next) => {
    req.id = randomUUID(); res.set({ 'X-Request-Id': req.id, 'Cache-Control': 'no-store' }); next();
  });
  app.use(helmet(), cors({ methods: ['POST'], origin(origin, callback) {
    callback(origin && !env.CORS_ORIGINS.includes(origin) ? new ApiError(403, 'Origen no permitido.') : null, true);
  } }));
  app.use(rateLimit({ windowMs: 60000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: { code: 'RATE_LIMIT', message: 'Demasiadas solicitudes. Probá más tarde.' } } }));
  app.use((req, res, next) => req.method === 'POST' ? next() : res.status(405).set('Allow', 'POST, OPTIONS')
    .json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Usá POST para consultar la API.' } }));
  app.use(express.json({ limit: '64kb' }));
  app.post('/api/health', (req, res) => res.json({ data: { status: 'ok' } }));
  app.use('/api/auth', authRoutes({ authService, authRepository, authenticate, userService }));
  app.use('/api', authenticate);
  app.use('/api/users', userRoutes(userService));
  app.use('/api/catalog', catalogRoutes(createCatalogRepository(db)));
  app.use('/api/photos', photoRoutes(createPhotoService(photoRepository, storage), createPhotoAssignmentService(db, photoRepository),
    createPhotoUploadService(db, photoRepository, storage, env)));
  app.use('/api/sales', salesRoutes(createSalesRepository(db)));
  app.use('/api/attendance', attendanceRoutes(createAttendanceRepository(db)));
  app.use('/api/reports', reportsRoutes(createReportsRepository(db)));
  app.use('/api', pendingRoutes());
  app.use((req, res, next) => next(new ApiError(404, 'La ruta no existe.', 'NOT_FOUND')));
  app.use(errorHandler);
  return app;
}
