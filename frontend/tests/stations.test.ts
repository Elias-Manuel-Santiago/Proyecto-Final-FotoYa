/**
 * @file
 * Verifica catálogos y puestos/tarifas. Protege contratos y restricciones por puesto.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { image } from './fixtures';
import { createSeed } from './support/seed';
import { MockFotoYaRepository } from './support/mock-repository';

test('solo el dueño administra puestos y la baja conserva el historial', async () => {
  const data = createSeed();
  data.cities = [{ id: 'city', name: 'Ciudad' }];
  data.events = [
    { id: 'event', name: 'Evento', cityId: 'city', directions: '' },
  ];
  const repo = new MockFotoYaRepository({ data });
  const input = {
    name: '  Entrada principal  ',
    eventId: 'event',
  };
  await assert.rejects(repo.createStation('manager', input), /permiso/);
  await assert.rejects(
    repo.setStationActive('secretary', 'centro', false),
    /permiso/,
  );
  await assert.rejects(
    repo.createStation('owner', { name: 'Entrada', eventId: 'missing' }),
    /evento no existe/,
  );
  await repo.createStation('owner', input);
  const created = (await repo.snapshot()).stations.at(-1)!;
  assert.equal(created.name, 'Entrada principal');
  assert.equal(created.cityId, 'city');
  assert.equal(created.eventId, 'event');
  await assert.rejects(repo.createStation('owner', input), /ya existe/);
  await repo.createStation('owner', { name: 'Salida', eventId: 'event' });
  assert.equal((await repo.snapshot()).stations.at(-1)!.name, 'Salida');
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
  const failed = await repo.uploadPhotos('editor', 'centro', [image]);
  assert.match(failed[0].error ?? '', /baja/);
  await repo.setStationActive('owner', 'centro', true);
  assert.equal(
    (await repo.uploadPhotos('editor', 'centro', [image]))[0].error,
    undefined,
  );
});
