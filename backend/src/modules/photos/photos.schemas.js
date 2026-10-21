/**
 * @file
 * Valida filtros, correo de asignación y UUID de carga. Normaliza el multipart para entregar
 * un contrato definido al servicio.
 */
import { z } from 'zod';
import { id, period } from '../../shared/validation.js';

// Los filtros de destinatario y sin asignar son excluyentes para evitar una consulta ambigua.
export const query = period.safeExtend({ clientId: id.optional(), unassigned: z.boolean().default(false) })
  .refine(v => !(v.clientId && v.unassigned), 'No combinar cliente con fotos sin asignar.');
export const detail = z.object({ photoId: id }).strict();
export const assign = z.object({ photoId: id, clientEmail: z.string().trim().toLowerCase().pipe(z.email().max(254)) }).strict();
// Multipart entrega texto: se unifica el UUID y se convierte el cliente ausente en null.
export const upload = z.object({ operationId: z.uuid().transform(v => v.toLowerCase()), stationId: id,
  clientId: z.preprocess(v => v === '' || v === undefined ? null : v, id.nullable()) }).strict();
