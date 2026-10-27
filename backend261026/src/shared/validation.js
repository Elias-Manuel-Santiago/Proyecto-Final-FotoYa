/**
 * @file
 * Comparte contratos Zod de IDs, paginación y períodos. validate produce req.input y endpoint
 * envuelve resultados exitosos en data.
 */
import { z } from 'zod';
import { ApiError } from './errors.js';

export const id = z.string().regex(/^[1-9]\d{0,19}$/).pipe(z.string().refine(v => BigInt(v) <= 18446744073709551615n));
export const pagination = { limit: z.number().int().min(1).max(100).default(30), offset: z.number().int().min(0).max(100000).default(0) };
export const period = z.object({ from: z.iso.date().optional(), to: z.iso.date().optional(), allTime: z.boolean().optional(), stationId: id.optional(), ...pagination }).strict()
  .refine(v => v.allTime ? v.from === undefined && v.to === undefined : v.from !== undefined && v.to !== undefined,
    'Elegí Siempre sin fechas, o indicá ambas fechas del período.')
  .refine(v => v.allTime || v.from <= v.to, 'El período está invertido.')
  .refine(v => v.allTime || (Date.parse(v.to) - Date.parse(v.from)) / 86400000 <= 366, 'El período máximo es de 367 días.');

// La opción Siempre omite solo la fecha; cada repositorio conserva su alcance autorizado.
export function periodDateFilter(input, column) {
  return input.allTime
    ? { sql: '1 = 1', params: [] }
    : { sql: `${column} BETWEEN ? AND ?`, params: [input.from, input.to] };
}
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
