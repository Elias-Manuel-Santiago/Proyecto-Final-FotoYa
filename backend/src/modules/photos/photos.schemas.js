/**
 * @file
 * Valida filtros y correo de asignación. Normaliza el multipart para entregar
 * un contrato definido al servicio.
 */
import { z } from 'zod';
import { id, pagination, period } from '../../shared/validation.js';

// Los filtros de destinatario y sin asignar son excluyentes para evitar una consulta ambigua.
const recipientFilters = { clientId: id.optional(), unassigned: z.boolean().default(false) };
export const query = z.union([
  period.safeExtend({ ...recipientFilters, allTime: z.literal(false).optional() }),
  z.object({ allTime: z.literal(true), stationId: id.optional(), ...pagination, ...recipientFilters }).strict(),
])
  .refine(v => !(v.clientId && v.unassigned), 'No combinar cliente con fotos sin asignar.');
export const detail = z.object({ photoId: id }).strict();
export const assign = z.object({ photoId: id, clientEmail: z.string().trim().toLowerCase().pipe(z.email().max(254)) }).strict();
// Multipart entrega texto: se convierte el cliente ausente en null.
export const upload = z.object({ stationId: id,
  clientId: z.preprocess(v => v === '' || v === undefined ? null : v, id.nullable()) }).strict();

export const visibility = z.object({ photoIds: z.array(id).min(1).max(100).refine(ids => new Set(ids).size === ids.length), hidden: z.boolean() }).strict();
