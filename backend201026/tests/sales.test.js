import test from 'node:test';
import assert from 'node:assert/strict';
import { saleInput, saleAmounts } from '../src/modules/sales/sales.schemas.js';
import { businessDate, currentEvent } from '../src/modules/sales/sales.rules.js';

test('el evento vence a medianoche argentina aunque su apertura manual siga registrada', () => {
  const before = new Date('2026-10-18T02:59:59.999Z'), after = new Date('2026-10-18T03:00:00Z');
  const event = { open: 1, date: '2026-10-17' };
  assert.equal(businessDate(before), '2026-10-17');
  assert(currentEvent(event, before));
  assert(!currentEvent(event, after));
  assert(currentEvent({ ...event, date: '2026-10-18' }, after));
  assert(!currentEvent({ ...event, open: 0 }, before));
});

const input = { operationId: '73ddf539-013b-4200-b7a9-96e43f8f1a31', stationId: '1', photoId: '2',
  paymentMethod: 'efectivo', prices: [{ priceId: '3', copies: 4 }] };
test('venta requiere tarifas, cantidades enteras, pago válido y no permite importes del cliente', () => {
  assert(saleInput.safeParse(input).success);
  for (const changed of [{ prices: [] }, { prices: [{ priceId: '3', copies: 0 }] },
    { prices: [{ priceId: '3', copies: 1.5 }] }, { prices: [...input.prices, ...input.prices] },
    { paymentMethod: 'otro' }, { total: '0.01' }]) assert(!saleInput.safeParse({ ...input, ...changed }).success);
});
test('sumas monetarias exactas con varias tarifas y copias, independientes de familias', () => {
  const amounts = saleAmounts([{ id: '1', amount: '0.10' }, { id: '2', amount: '1234567890.99' }],
    [{ priceId: '1', copies: 3 }, { priceId: '2', copies: 10000 }]);
  assert.equal(amounts.total, '12345678909900.30');
  assert.equal(amounts.copies, 10003);
  assert.equal(amounts.applied[0].unitPrice, '0.10');
});
