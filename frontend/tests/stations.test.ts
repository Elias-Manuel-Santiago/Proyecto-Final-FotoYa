/**
 * @file
 * Verifica catálogos y puestos/tarifas. Protege contratos y restricciones por puesto.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { image, repository } from './fixtures';

test('solo el dueño administra puestos y la baja conserva el historial', async () => {
  const repo = repository();
  const input = {
    name: 'Nuevo',
    address: 'Calle 1',
    city: 'Ciudad',
    event: '',
  };
  await assert.rejects(repo.createStation('manager', input), /permiso/);
  await assert.rejects(
    repo.setStationActive('secretary', 'centro', false),
    /permiso/,
  );
  await repo.createStation('owner', input);
  await assert.rejects(repo.createStation('owner', input), /ya existe/);
  const before = await repo.snapshot();
  await repo.setStationActive('owner', 'centro', false);
  const after = await repo.snapshot();
  assert.deepEqual(after.employees, before.employees);
  assert.deepEqual(after.counts, before.counts);
  assert.deepEqual(after.sales, before.sales);
  assert.deepEqual(after.attendance, before.attendance);
  assert.equal(
    after.stations.find((row) => row.id === 'centro')?.active,
    false,
  );
  const failed = await repo.uploadPhotos('photographer', 'centro', [image]);
  assert.match(failed[0].error ?? '', /baja/);
  await repo.setStationActive('owner', 'centro', true);
  assert.equal(
    (await repo.uploadPhotos('photographer', 'centro', [image]))[0].error,
    undefined,
  );
});
