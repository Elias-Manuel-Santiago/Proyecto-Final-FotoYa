import assert from 'node:assert/strict';
import test from 'node:test';
import { MockFotoYaRepository } from '../src/data/mock-repository';
import { createSeed } from '../src/data/seed';
import { can } from '../src/domain/permissions';
import { visibleStations } from '../src/domain/metrics';
import { image, now, repository, sale, today } from './fixtures';

test('una carga suma una sola vez, conserva su referencia y no registra ventas', async () => {
  const repo = repository();
  await repo.uploadPhotos('photographer', 'centro', [image]);
  await repo.uploadPhotos('photographer', 'centro', [image]);
  const data = await repo.snapshot();
  assert.equal(
    data.counts.find((row) => row.stationId === 'centro' && row.date === today)
      ?.taken,
    101,
  );
  assert.equal(data.photos.length, 1);
  assert.equal(data.photos[0].uri, image.uri);
  assert.equal(data.sales.length, 2);
});

test('una carga parcial cuenta solo confirmadas y admite reintentar la fallida', async () => {
  let failing = true;
  const repo = new MockFotoYaRepository({
    now: () => now,
    storePhoto: (file) => {
      if (file.key === 'photo-2' && failing) throw new Error('Fallo de prueba');
      return file.uri;
    },
  });
  const batch = [image, { ...image, key: 'photo-2' }];
  const results = await repo.uploadPhotos('photographer', 'centro', batch);
  assert.equal(results[1].error, 'Fallo de prueba');
  assert.equal((await repo.snapshot()).counts[0].taken, 101);
  failing = false;
  await repo.uploadPhotos('photographer', 'centro', batch);
  assert.equal((await repo.snapshot()).counts[0].taken, 102);
});

test('archivos vacíos o que no son imágenes no incrementan el conteo', async () => {
  const repo = repository();
  const results = await repo.uploadPhotos('photographer', 'centro', [
    { ...image, size: 0 },
    { ...image, key: 'text', mimeType: 'text/plain' },
  ]);
  assert.equal(results.filter((row) => row.error).length, 2);
  assert.equal((await repo.snapshot()).photos.length, 0);
});

test('la matriz de permisos distingue administración, consulta y operación', () => {
  const data = createSeed();
  const get = (id: string) => data.employees.find((row) => row.id === id)!;
  for (const id of ['owner', 'secretary'])
    assert.equal(visibleStations(data, get(id)).length, 3);
  for (const id of ['manager', 'photographer', 'seller'])
    assert.deepEqual(
      visibleStations(data, get(id)).map((row) => row.id),
      ['centro'],
    );
  assert.equal(can(get('secretary'), 'employees.manage'), false);
  assert.equal(can(get('owner'), 'photos.upload'), false);
  assert.equal(can(get('owner'), 'sales.create'), false);
  assert.equal(can(get('seller'), 'photos.read'), false);
  for (const permission of [
    'employees.manage',
    'photos.upload',
    'sales.create',
  ] as const)
    assert.equal(can(get('manager'), permission), true);
});

test('el adaptador rechaza operaciones invocadas sin permiso o en otro puesto', async () => {
  const repo = repository();
  await assert.rejects(repo.recordSale('photographer', sale), /permiso/);
  await assert.rejects(repo.recordSale('owner', sale), /permiso/);
  await assert.rejects(
    repo.recordSale('manager', { ...sale, stationId: 'parque' }),
    /alcance/,
  );
  await assert.rejects(
    repo.uploadPhotos('seller', 'centro', [image]),
    /permiso/,
  );
  await assert.rejects(
    repo.uploadPhotos('manager', 'parque', [image]),
    /alcance/,
  );
});

test('cargar en un nuevo día crea un conteo en ese día y puesto', async () => {
  const tomorrow = new Date(now.getTime() + 86400000);
  const repo = new MockFotoYaRepository({ now: () => tomorrow });
  await repo.uploadPhotos('manager', 'centro', [image]);
  const data = await repo.snapshot();
  assert.equal(data.counts.length, 3);
  assert.equal(data.counts[2].taken, 1);
  assert.equal(data.counts[0].taken, 100);
  await assert.rejects(
    repo.recordSale('other-seller', { ...sale, stationId: 'parque' }),
    /conteo/,
  );
});
