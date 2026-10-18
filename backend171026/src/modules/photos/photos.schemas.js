import { z } from 'zod';
import { id, period } from '../../shared/validation.js';

export const query = period.safeExtend({ clientId: id.optional(), unassigned: z.boolean().default(false) })
  .refine(v => !(v.clientId && v.unassigned), 'No combinar cliente con fotos sin asignar.');
export const detail = z.object({ photoId: id }).strict();
export const assign = z.object({ photoId: id, clientId: id }).strict();
export const upload = z.object({ operationId: z.uuid().transform(v => v.toLowerCase()), stationId: id,
  clientId: z.preprocess(v => v === '' || v === undefined ? null : v, id.nullable()) }).strict();
