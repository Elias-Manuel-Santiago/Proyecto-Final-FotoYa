import test from 'node:test';
import assert from 'node:assert/strict';
import { createEventCache } from '../src/modules/sales/sales.events.js';
import { currentEvent } from '../src/modules/sales/sales.rules.js';

test('la apertura es por puesto, vence con el día argentino y se pierde al reiniciar', () => {
  const cache = createEventCache();
  const now = new Date('2026-10-22T02:59:00Z');
  cache.set(1, { open: true, date: '2026-10-21', dayId: '12' });
  assert.equal(currentEvent(cache.get('1'), now), true);
  assert.equal(cache.get('2'), undefined);
  assert.equal(currentEvent(cache.get('1'), new Date('2026-10-22T03:00:00Z')), false);
  assert.equal(createEventCache().get('1'), undefined);
  cache.set('1', { ...cache.get('1'), open: false });
  assert.equal(currentEvent(cache.get(1), now), false);
});

test('un cierre espera la venta en curso y no bloquea otros puestos', async () => {
  const cache = createEventCache();
  const order = [];
  let finishSale;
  const gate = new Promise(resolve => { finishSale = resolve; });
  const sale = cache.run('1', async () => { order.push('venta'); await gate; order.push('confirmada'); });
  const close = cache.run(1, async () => { order.push('cierre'); });
  await cache.run('2', async () => { order.push('otro puesto'); });
  assert.deepEqual(order, ['venta', 'otro puesto']);
  finishSale();
  await Promise.all([sale, close]);
  assert.deepEqual(order, ['venta', 'otro puesto', 'confirmada', 'cierre']);
});

test('una transacción fallida libera el puesto para las siguientes operaciones', async () => {
  const cache = createEventCache();
  const failed = cache.run('1', async () => { throw new Error('rollback'); });
  const next = cache.run('1', async () => 'disponible');
  await assert.rejects(failed, /rollback/);
  assert.equal(await next, 'disponible');
});
