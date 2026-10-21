/**
 * @file
 * Verifica contratos de asignación. Documenta validación de correo y reglas de la operación.
 */
import test, { mock, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { db } from '../src/config/database.js';
import { photoRepository } from '../src/modules/photos/photos.repository.js';
import { photoAssignments } from '../src/modules/photos/photos.assignment.js';
import { actor } from './fixtures.js';
import { businessDate } from '../src/modules/sales/sales.rules.js';
import { salesService } from '../src/modules/sales/sales.service.js';
import { salesRepository } from '../src/modules/sales/sales.repository.js';
import { eventCache } from '../src/modules/sales/sales.events.js';

afterEach(() => mock.restoreAll());
after(() => db.end());

function setup({ client, photoClient = null, stationId = '10', open = true, permission = true } = {}) {
  mock.method(eventCache, 'get', () => ({ open, date: businessDate() }));
  const photo = { id: '1', stationId, date: businessDate(), clientId: photoClient, file: 'private.jpg' };
  const updates = [];
  let commits = 0, rollbacks = 0;
  const connection = {
    beginTransaction: async () => {}, commit: async () => { commits++; },
    rollback: async () => { rollbacks++; }, release: () => {},
    execute: async (sql, params) => {
      if (sql.includes('SELECT id_puesto AS stationId')) return [[{ stationId: '10', roleId: '2' }]];
      if (sql.includes('JOIN permisos_rol')) return [permission ? [{ role: 'encargado' }] : []];
      if (sql.includes('WHERE u.email')) return [client ? [client] : []];
      if (sql.startsWith('UPDATE fotos')) {
        updates.push(params); photo.clientId = params[0]; photo.clientEmail = params[1];
        return [{}];
      }
      assert.fail(`Consulta inesperada: ${sql}`);
    },
  };
  mock.method(db, 'getConnection', async () => connection);
  mock.method(photoRepository, 'find', async () => ({ ...photo }));
  return { updates, committed: () => commits, rolledBack: () => rollbacks };
}

test('guarda mail sin cuenta y conserva la foto privada sin asignar', async () => {
  const state = setup();
  const result = await photoAssignments.assign(actor('encargado'), { photoId: '1', clientEmail: 'futuro@example.com' });
  assert.equal(result.clientId, null);
  assert.equal(result.clientEmail, 'futuro@example.com');
  assert.equal(result.file, undefined);
  assert.deepEqual(state.updates, [[null, 'futuro@example.com', '1']]);
  assert.equal(state.committed(), 1);
});

test('resuelve cliente por mail y permite repetir la misma asociación', async () => {
  const state = setup({ client: { id: '7', active: true, role: 'cliente' }, photoClient: '7' });
  const result = await photoAssignments.assign(actor('encargado'), { photoId: '1', clientEmail: 'cliente@example.com' });
  assert.equal(result.clientId, '7');
  assert.equal(state.committed(), 1);
});

test('no reasigna una foto vinculada a otro cliente', async () => {
  const state = setup({ client: { id: '8', active: true, role: 'cliente' }, photoClient: '7' });
  await assert.rejects(photoAssignments.assign(actor('encargado'), { photoId: '1', clientEmail: 'otro@example.com' }), { code: 'PHOTO_ALREADY_ASSIGNED' });
  assert.equal(state.updates.length, 0);
  assert.equal(state.rolledBack(), 1);
});

test('no acepta cuentas de empleados o clientes inactivos', async () => {
  for (const client of [{ id: '7', active: true, role: 'vendedor' }, { id: '7', active: false, role: 'cliente' }]) {
    const state = setup({ client });
    await assert.rejects(photoAssignments.assign(actor('encargado'), { photoId: '1', clientEmail: 'cliente@example.com' }), { code: 'INVALID_CLIENT' });
    assert.equal(state.updates.length, 0);
    mock.restoreAll();
  }
});

test('guardado desde venta exige evento abierto y autorización actual', async () => {
  for (const options of [{ open: false }, { permission: false }, { stationId: '99' }]) {
    const state = setup(options);
    await assert.rejects(photoAssignments.assign(actor('encargado'), { photoId: '1', clientEmail: 'cliente@example.com' }, 'sales.create'));
    assert.equal(state.updates.length, 0);
    mock.restoreAll();
  }
  const state = setup();
  await photoAssignments.assign(actor('encargado'), { photoId: '1', clientEmail: 'cliente@example.com' }, 'sales.create');
  assert.equal(state.committed(), 1);
});

test('el historial rechaza fotos ajenas a la venta y conserva el alcance de la foto vinculada', async () => {
  mock.method(salesRepository, 'detail', async () => ({ photos: [{ photoId: '1' }] }));
  const access = mock.method(photoRepository, 'find', async () => ({ stationId: '99', file: 'private.jpg' }));
  await assert.rejects(salesService.accessSoldPhoto(actor('vendedor'), { saleId: '2', photoId: '3' }), { status: 404 });
  assert.equal(access.mock.callCount(), 0);
  await assert.rejects(salesService.accessSoldPhoto(actor('vendedor'), { saleId: '2', photoId: '1' }), { status: 404 });
});
