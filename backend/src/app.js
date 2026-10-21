/**
 * @file
 * Ensambla Express y la API. El orden de CORS, límites, autenticación, jornada, rutas y
 * errores determina qué solicitudes llegan a cada operación.
 */
import { env } from './config/env.js';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { rateLimit } from 'express-rate-limit';
import { randomUUID } from 'node:crypto';
import { authenticate } from './security/authenticate.js';
import { workAccess } from './security/work-access.js';
import { ApiError, errorHandler } from './shared/errors.js';
import { authRoutes } from './modules/auth/auth.routes.js';
import { userRoutes } from './modules/users/users.routes.js';
import { clientRoutes } from './modules/users/clients.routes.js';
import { photoRoutes } from './modules/photos/photos.routes.js';
import { salesRoutes } from './modules/sales/sales.routes.js';
import { attendanceRoutes } from './modules/attendance/attendance.routes.js';
import { reportsRoutes } from './modules/reports/reports.routes.js';
import { catalogRoutes } from './modules/catalog/catalog.routes.js';
import { pendingRoutes } from './modules/pending/pending.routes.js';

// Ensambla protección HTTP, rutas públicas, sesión/jornada y módulos privados en ese orden.
export function createApp() {
  const app = express();
  app.disable('x-powered-by'); app.set('trust proxy', env.TRUST_PROXY);
  app.use((req, res, next) => {
    req.id = randomUUID(); res.set({ 'X-Request-Id': req.id, 'Cache-Control': 'no-store' }); next();
  });
  // La protección general se ejecuta también sobre login y health, antes de resolver una sesión.
  app.use(helmet(), cors({ methods: ['POST'], origin(origin, callback) {
    callback(origin && !env.CORS_ORIGINS.includes(origin) ? new ApiError(403, 'Origen no permitido.') : null, true);
  } }));
  app.use(rateLimit({ windowMs: 60000, limit: 120, standardHeaders: 'draft-8', legacyHeaders: false,
    message: { error: { code: 'RATE_LIMIT', message: 'Demasiadas solicitudes. Probá más tarde.' } } }));
  app.use((req, res, next) => req.method === 'POST' ? next() : res.status(405).set('Allow', 'POST, OPTIONS')
    .json({ error: { code: 'METHOD_NOT_ALLOWED', message: 'Usá POST para consultar la API.' } }));
  app.use(express.json({ limit: '64kb' }));
  app.post('/api/health', (req, res) => res.json({ data: { status: 'ok' } }));
  // Las rutas de autenticación gestionan sus propias operaciones públicas y privadas.
  app.use('/api/auth', authRoutes());
  // Desde este punto los módulos reciben un actor autenticado y habilitado para trabajar.
  app.use('/api', authenticate, workAccess);
  app.use('/api/users', userRoutes());
  app.use('/api/clients', clientRoutes());
  app.use('/api/catalog', catalogRoutes());
  app.use('/api/photos', photoRoutes());
  app.use('/api/sales', salesRoutes());
  app.use('/api/attendance', attendanceRoutes());
  app.use('/api/reports', reportsRoutes());
  app.use('/api', pendingRoutes());
  app.use((req, res, next) => next(new ApiError(404, 'La ruta no existe.', 'NOT_FOUND')));
  // El manejador final convierte errores de validación, negocio e infraestructura al contrato común.
  app.use(errorHandler);
  return app;
}
