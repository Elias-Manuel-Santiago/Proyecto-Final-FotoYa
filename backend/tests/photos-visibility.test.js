import test, { mock, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/config/database.js';
import { photoRepository } from '../src/modules/photos/photos.repository.js';
import { setPhotoVisibility } from '../src/modules/photos/photos.visibility.js';
import { visibility } from '../src/modules/photos/photos.schemas.js';
import { salesService } from '../src/modules/sales/sales.service.js';
import { eventCache } from '../src/modules/sales/sales.events.js';
import { businessDate } from '../src/modules/sales/sales.rules.js';
import { actor } from './fixtures.js';

afterEach(() => mock.restoreAll());
after(() => db.end());

function setup({ outside = false, allowed = true } = {}) {
  const updates = [];
  let committed = false, rolledBack = false;
  const connection = {
    beginTransaction: async () => {}, release: () => {},
    commit: async () => { committed = true; }, rollback: async () => { rolledBack = true; },
    execute: async (sql, values) => {
      if (sql.includes('SELECT id_puesto AS stationId')) return [[{ stationId: '10', roleId: '2' }]];
      if (sql.includes('JOIN permisos_rol')) return [allowed ? [{ role: 'encargado' }] : []];
      assert.match(sql, /^UPDATE fotos SET oculta =/);
      updates.push(values);
      return [{ affectedRows: 1 }];
    },
  };
  mock.method(db, 'getConnection', async () => connection);
  mock.method(photoRepository, 'find', async id => ({ id, stationId: outside ? '99' : '10', file: 'private.jpg' }));
  return { updates, committed: () => committed, rolledBack: () => rolledBack };
}

test('hiding and restoring a batch only updates shared visibility', async () => {
  for (const hidden of [true, false]) {
    const state = setup();
    const result = await setPhotoVisibility(actor('encargado', { permissions: ['photos.assign'] }), { photoIds: ['2', '1'], hidden });
    assert.deepEqual(state.updates, [[hidden, '1'], [hidden, '2']]);
    assert.equal(state.committed(), true);
    assert.equal(result.hidden, hidden);
    mock.restoreAll();
  }
});

test('seller can hide photos but clients cannot', async () => {
  const state = setup();
  await setPhotoVisibility(actor('vendedor', { permissions: ['sales.create'] }), { photoIds: ['1'], hidden: true });
  assert.equal(state.committed(), true);
  assert.throws(() => setPhotoVisibility(actor('cliente'), { photoIds: ['1'], hidden: true }), { status: 403 });
});

test('out-of-station and revoked permissions roll back without updates', async () => {
  for (const options of [{ outside: true }, { allowed: false }]) {
    const state = setup(options);
    await assert.rejects(setPhotoVisibility(actor('encargado', { permissions: ['photos.assign'] }), { photoIds: ['1'], hidden: true }), { status: 403 });
    assert.equal(state.updates.length, 0);
    assert.equal(state.rolledBack(), true);
    mock.restoreAll();
  }
});

test('visibility validates batch size, IDs and boolean state', () => {
  for (const input of [
    { photoIds: [], hidden: true }, { photoIds: ['1', '1'], hidden: true },
    { photoIds: ['1'], hidden: 'true' }, { photoIds: Array.from({ length: 101 }, (_, i) => String(i + 1)), hidden: true },
  ]) assert.equal(visibility.safeParse(input).success, false);
});

test('sales lists exclude hidden photos by default and can list them for restoration', async () => {
  mock.method(eventCache, 'get', () => ({ open: true, date: businessDate(), dayId: '2' }));
  const queries = [];
  mock.method(db, 'execute', async (sql, values) => { queries.push({ sql, values }); return [[]]; });
  for (const hidden of [undefined, true]) await salesService.photos(actor('vendedor', { permissions: ['sales.create'] }), { stationId: '10', limit: 48, offset: 0, hidden });
  assert.match(queries[0].sql, /f.oculta = 0/);
  assert.match(queries[1].sql, /f.oculta = 1/);
  assert.deepEqual(queries[0].values, ['10', '2', '48', '0']);
});
