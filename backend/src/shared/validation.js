/**
 * @file
 * Comparte contratos Zod de IDs, paginación y períodos. validate produce req.input y endpoint
 * envuelve resultados exitosos en data.
 */
import { z } from 'zod';
import { ApiError } from './errors.js';

export const id = z.string().regex(/^[1-9]\d{0,19}$/).pipe(z.string().refine(v => BigInt(v) <= 18446744073709551615n));
export const pagination = { limit: z.number().int().min(1).max(100).default(30), offset: z.number().int().min(0).max(100000).default(0) };
export const period = z.object({ from: z.iso.date(), to: z.iso.date(), stationId: id.optional(), ...pagination }).strict()
  .refine(v => v.from <= v.to, 'El período está invertido.')
  .refine(v => (Date.parse(v.to) - Date.parse(v.from)) / 86400000 <= 366, 'El período máximo es de 367 días.');
export const paged = z.object(pagination).strict();

// Valida el cuerpo con Zod y entrega datos normalizados en req.input al endpoint.
export function validate(schema) {
  return (req, res, next) => {
    const parsed = schema.safeParse(req.body ?? {});
    if (!parsed.success) return next(new ApiError(422, parsed.error.issues.map(i => `${i.path.join('.') || 'body'}: ${i.message}`).join('; '), 'VALIDATION_ERROR'));
    req.input = parsed.data; next();
  };
}

// Espera el resultado del caso de uso y aplica el sobre JSON de éxito compartido.
export const endpoint = handler => async (req, res) => {
  const data = await handler(req);
  res.json({ data });
};
