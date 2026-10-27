/**
 * @file
 * Valida contraseña de salida y credenciales de marcación. Incluye acción y asistencia
 * esperada para detectar listas desactualizadas.
 */
import { z } from 'zod';
import { id } from '../../shared/validation.js';
import { login } from '../auth/auth.schemas.js';

// attendanceId es el turno visto por la pantalla; null representa que esperaba iniciar uno nuevo.
export const mark = login.extend({ userId: id, action: z.enum(['check-in', 'check-out']), attendanceId: id.nullable() }).strict();
export const exit = z.object({ password: z.string().min(1).max(128) }).strict();

export const empty = z.object({}).strict();
export const setEvent = z.object({ open: z.boolean() }).strict();
