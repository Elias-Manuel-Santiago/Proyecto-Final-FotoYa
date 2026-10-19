import { z } from 'zod';
import { id, pagination } from '../../shared/validation.js';

export const saleInput = z.object({
  operationId: z.uuid(),
  photoId: id,
  stationId: id,
  paymentMethod: z.enum(['efectivo', 'transferencia', 'tarjeta']),
  prices: z.array(z.object({ priceId: id, copies: z.number().int().min(1).max(10000) }).strict()).min(1).max(30),
}).strict().refine(input => new Set(input.prices.map(row => row.priceId)).size === input.prices.length,
  'Cada tarifa debe aparecer una sola vez.');

export const salePhotosInput = z.object({ stationId: id, ...pagination }).strict();

// DECIMAL se calcula en centavos enteros; el cliente nunca decide el importe.
export function saleAmounts(prices, lines) {
  let total = 0n, copies = 0;
  const applied = lines.map(line => {
    const price = prices.find(row => String(row.id) === line.priceId);
    if (!price) return null;
    const [integer, fraction = ''] = String(price.amount).split('.');
    const cents = BigInt(integer) * 100n + BigInt(fraction.padEnd(2, '0'));
    total += cents * BigInt(line.copies);
    copies += line.copies;
    return { ...line, unitPrice: String(price.amount) };
  });
  return { applied, copies, total: `${total / 100n}.${String(total % 100n).padStart(2, '0')}` };
}
