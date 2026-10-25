/**
 * @file
 * Valida datos personales y asignaciones. Distingue campos de alta, edición, disponibilidad y
 * búsqueda de usuarios.
 */
import { z } from 'zod';
import { id, pagination } from '../../shared/validation.js';
import { email, password } from '../auth/auth.schemas.js';

// Los contratos de alta y edición comparten datos personales, rol y puesto nullable.
const fields = {
  firstName: z.string().trim().min(1).max(100), lastName: z.string().trim().min(1).max(100), email,
  dni: z.string().regex(/^[\d.\s-]{5,20}$/).transform(v => v.replace(/[.\s-]/g, '')).pipe(z.string().regex(/^\d{5,15}$/)),
  roleId: id, stationId: id.nullable(),
};
// Solo el alta recibe contraseña; editar datos o disponibilidad usa contratos separados.
export const create = z.object({ ...fields, password }).strict();
export const update = z.object({ userId: id, ...fields }).strict();
export const active = z.object({ userId: id, active: z.boolean() }).strict();
export const detail = z.object({ userId: id }).strict();
export const auth0Query = z.object({}).strict();
export const query = z.object({ ...pagination, stationId: id.optional(), email: email.optional(),
  dni: fields.dni.optional(), active: z.boolean().optional() }).strict();
