/** Verifica el indicador de venta con los formatos numéricos devueltos por MySQL. */
import test, { mock, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/config/database.js';
import { salesService } from '../src/modules/sales/sales.service.js';
import { eventCache } from '../src/modules/sales/sales.events.js';
import { businessDate } from '../src/modules/sales/sales.rules.js';
import { actor } from './fixtures.js';

afterEach(() => mock.restoreAll());
after(() => db.end());

test('fotos sin venta conservan sold=false incluso cuando MySQL devuelve "0"', async () => {
  mock.method(eventCache, 'get', () => ({ open: true, date: businessDate(), dayId: '2' }));
  const states = ['0', '1', 0, 1];
  mock.method(db, 'execute', async () => [states.map((sold, index) => ({
    id: String(index + 1), date: businessDate(), clientId: null, sold,
  }))]);
  const photos = await salesService.photos(actor('vendedor'), { stationId: '10', limit: 12, offset: 0 });
  assert.deepEqual(photos.map(photo => photo.sold), [false, true, false, true]);
});
