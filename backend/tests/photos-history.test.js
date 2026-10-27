import test, { mock, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/config/database.js';
import { query } from '../src/modules/photos/photos.schemas.js';
import { photoService } from '../src/modules/photos/photos.service.js';
import { actor } from './fixtures.js';

afterEach(() => mock.restoreAll());
after(() => db.end());

test('Siempre omits dates while retaining client ownership and pagination', async () => {
  mock.method(db, 'execute', async (sql, values) => {
    assert(!sql.includes('BETWEEN'));
    assert.match(sql, /WHERE f.id_cliente = \?/);
    assert.deepEqual(values, ['7', '100', '100']);
    return [[{ id: '91', date: '2020-01-01', clientId: '7' }]];
  });
  const rows = await photoService.query(
    actor('cliente', { id: '7' }),
    query.parse({ allTime: true, limit: 100, offset: 100 }),
  );
  assert.equal(rows[0].date, '2020-01-01');
});

test('Siempre preserves station restrictions for staff', async () => {
  mock.method(db, 'execute', async (sql, values) => {
    assert(!sql.includes('BETWEEN'));
    assert.match(sql, /WHERE f.id_puesto = \?/);
    assert.deepEqual(values, ['10', '30', '0']);
    return [[]];
  });
  await photoService.query(actor('editor'), query.parse({ allTime: true }));
});

test('Siempre does not allow clients to request another client or unassigned photos', () => {
  for (const filter of [{ clientId: '8' }, { unassigned: true }]) {
    assert.throws(() => photoService.query(
      actor('cliente', { id: '7' }),
      query.parse({ allTime: true, ...filter }),
    ), { status: 403 });
  }
});

test('dated queries keep their validation and date restriction', async () => {
  for (const input of [
    {}, { allTime: false }, { allTime: 'true' },
    { from: '2020-01-01', to: '2026-01-01' },
    { from: '2026-10-02', to: '2026-10-01' },
    { allTime: true, from: '2026-10-01', to: '2026-10-02' },
  ]) assert.equal(query.safeParse(input).success, false);
  mock.method(db, 'execute', async (sql, values) => {
    assert.match(sql, /d.fecha BETWEEN \? AND \?/);
    assert.deepEqual(values, ['2026-10-01', '2026-10-02', '7', '30', '0']);
    return [[]];
  });
  await photoService.query(actor('cliente', { id: '7' }), query.parse({
    from: '2026-10-01', to: '2026-10-02',
  }));
});
