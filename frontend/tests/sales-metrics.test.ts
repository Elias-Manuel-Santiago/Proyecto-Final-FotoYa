import assert from 'node:assert/strict';
import test from 'node:test';
import {
  stationMetrics,
  totalMetrics,
  reportRows,
} from '../src/domain/metrics';
import { saleAmounts } from '../src/domain/validation';
import { createSeed } from '../src/data/seed';
import { sumAmounts } from '../src/domain/amounts';
import { repository, sale, today } from './fixtures';

test('un rango con días sin conteo no presenta una suma parcial como conteo completo', () => {
  const data = createSeed();
  const from = new Date(Date.parse(`${today}T12:00:00Z`) - 86400000)
    .toISOString()
    .slice(0, 10);
  const values = stationMetrics(data, data.stations[0], {
    from,
    to: today,
    stationId: 'centro',
  });
  assert.equal(values.registeredDays, 1);
  assert.equal(values.expectedDays, 2);
  assert.equal(values.taken, null);
  assert.equal(values.discarded, null);
  assert.equal(values.earnings, 700);
  assert.equal(sumAmounts([0.1, 0.2]), 0.3);
});

test('100 tomadas y 70 vendidas dan 30 descartes; una venta actualiza cantidades y ganancias', async () => {
  const repo = repository();
  let data = await repo.snapshot();
  const period = { from: today, to: today, stationId: 'centro' };
  assert.equal(stationMetrics(data, data.stations[0], period).discarded, 30);
  await repo.recordSale('seller', sale);
  data = await repo.snapshot();
  const values = stationMetrics(data, data.stations[0], period);
  assert.equal(values.taken, 100);
  assert.equal(values.sold, 80);
  assert.equal(values.discarded, 20);
  assert.equal(values.earnings, 825);
  assert.equal(values.percentage, 80);
  assert.equal(
    stationMetrics(data, data.stations[1], { ...period, stationId: 'parque' })
      .sold,
    20,
  );
});

test('reintentos y llamadas simultáneas de la misma venta contabilizan una sola operación', async () => {
  const repo = repository();
  await Promise.all([
    repo.recordSale('seller', sale),
    repo.recordSale('seller', sale),
  ]);
  const data = await repo.snapshot();
  assert.equal(
    data.sales.filter((row) => row.operationId === sale.operationId).length,
    1,
  );
  await assert.rejects(
    repo.recordSale('seller', { ...sale, quantity: '5' }),
    /otros datos/,
  );
});

test('ventas simultáneas no superan el saldo de su puesto', async () => {
  const repo = repository();
  const results = await Promise.allSettled([
    repo.recordSale('seller', { ...sale, quantity: '20' }),
    repo.recordSale('seller', {
      ...sale,
      operationId: 'another-sale',
      quantity: '20',
    }),
  ]);
  assert.equal(results.filter((row) => row.status === 'fulfilled').length, 1);
  assert.equal((await repo.snapshot()).sales.length, 3);
});

test('se rechazan cantidades no positivas, fracciones, importes inválidos y sobreventa sin mutar el estado', async () => {
  const repo = repository();
  for (const quantity of ['-1', '0', '1.5', 'abc', '31', '9007199254740992']) {
    await assert.rejects(repo.recordSale('seller', { ...sale, quantity }));
  }
  for (const unitPrice of ['-1', '', '1,234', 'NaN']) {
    await assert.rejects(repo.recordSale('seller', { ...sale, unitPrice }));
  }
  assert.equal((await repo.snapshot()).sales.length, 2);
  assert.equal(saleAmounts('3', '0,10').total, 0.3);
});

test('vender todas las fotos deja cero descartes sin borrar archivos', async () => {
  const repo = repository();
  await repo.recordSale('seller', { ...sale, quantity: '30' });
  const data = await repo.snapshot();
  assert.equal(
    stationMetrics(data, data.stations[0], {
      from: today,
      to: today,
      stationId: '',
    }).discarded,
    0,
  );
});

test('un puesto sin conteo conserva la ausencia, otro con cero no tiene porcentaje', () => {
  const data = createSeed();
  const period = { from: today, to: today, stationId: '' };
  assert.equal(stationMetrics(data, data.stations[2], period).taken, null);
  data.counts.push({ stationId: 'costanera', date: today, taken: 0 });
  const values = stationMetrics(data, data.stations[2], period);
  assert.equal(values.taken, 0);
  assert.equal(values.discarded, 0);
  assert.equal(values.percentage, null);
});

test('el porcentaje agregado usa las sumas y los filtros mantienen puestos sin ventas', async () => {
  const data = await repository().snapshot();
  const actor = data.employees.find((row) => row.id === 'owner')!;
  const period = { from: today, to: today, stationId: '' };
  const rows = reportRows(data, actor, period);
  assert.equal(rows.length, 3);
  assert.equal(totalMetrics(rows).taken, null);
  assert.equal(totalMetrics(rows.slice(0, 2)).percentage, 60);
  assert.equal(totalMetrics(rows.slice(0, 2)).earnings, 900);
  assert.deepEqual(
    reportRows(data, actor, { ...period, city: 'La Plata' }).map(
      (row) => row.station.id,
    ),
    ['parque'],
  );
});
