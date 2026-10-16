import test from 'node:test';
import assert from 'node:assert/strict';
import { createPhotoService } from '../src/modules/photos/photos.service.js';
import { createStorage } from '../src/integrations/storage.js';
import { photoFormat, MAX_PHOTO_BYTES } from '../src/modules/photos/photos.files.js';
import { businessDate } from '../src/modules/photos/photos.upload.js';
import * as schema from '../src/modules/photos/photos.schemas.js';
import { env, actor } from './fixtures.js';

test('cliente no accede a metadatos ni archivos de otro cliente', async () => {
  let signed = 0;
  const row = { id: '2', clientId: '9', stationId: '10', file: 'private/photo.jpg' };
  const service = createPhotoService({ find: async () => row, query: async (user, input, station) => ({ user, station }) },
    { signedUrl: async () => { signed++; return {}; } });
  const client = actor('cliente', { id: '8', stationId: null });
  await assert.rejects(service.detail(client, '2'), { status: 404 });
  await assert.rejects(service.access(client, '2'), { status: 404 });
  assert.equal(signed, 0);
  const ownerClient = { ...client, id: '9' };
  assert.equal((await service.detail(ownerClient, '2')).file, undefined);
  await service.access(ownerClient, '2'); assert.equal(signed, 1);
  assert.throws(() => service.query(client, { clientId: '9' }), { status: 403 });
});
test('encargado no obtiene fotos de otro puesto', async () => {
  const service = createPhotoService({ find: async () => ({ stationId: '99' }) }, {});
  await assert.rejects(service.detail(actor('encargado'), '2'), { status: 404 });
});
test('Axios firma con POST, codifica rutas y limita la vigencia', async () => {
  let request;
  const storage = createStorage(env, async config => {
    request = config;
    return { data: { signedURL: '/object/sign/foto-ya/foto.jpg?token=example' }, status: 200, headers: {}, config };
  });
  const response = await storage.signedUrl('folder/foto con espacio.jpg');
  assert.equal(request.method, 'post');
  assert.equal(request.url, '/object/sign/foto-ya/folder/foto%20con%20espacio.jpg');
  assert.equal(JSON.parse(request.data).expiresIn, 60);
  assert.equal(response.url, 'https://example.supabase.co/storage/v1/object/sign/foto-ya/foto.jpg?token=example');
  assert.equal(request.maxRedirects, 0);
});
test('fallo de Storage no filtra la clave ni el error del proveedor', async () => {
  const storage = createStorage(env, async () => { throw new Error(env.SUPABASE_SECRET_KEY); });
  await assert.rejects(storage.signedUrl('file.jpg'), error => error.status === 502 && !error.message.includes(env.SUPABASE_SECRET_KEY));
});
test('rutas privadas inválidas no llegan al proveedor', async () => {
  let called = false;
  const storage = createStorage(env, async () => { called = true; throw new Error('Unexpected call'); });
  for (const file of ['../other-bucket/a.jpg', '/a.jpg', 'folder/../a.jpg', 'folder\\a.jpg', 'folder//a.jpg'])
    await assert.rejects(storage.signedUrl(file), { status: 502 });
  assert.equal(called, false);
});
test('fotos sin cliente no entregan metadatos ni archivos a ningún cliente', async () => {
  const service = createPhotoService({ find: async () => ({ clientId: null, stationId: '10', file: 'private.jpg' }) },
    { signedUrl: () => assert.fail('No debe firmarse una foto sin cliente') });
  await assert.rejects(service.detail(actor('cliente'), '1'), { status: 404 });
  await assert.rejects(service.access(actor('cliente'), '1'), { status: 404 });
  assert.throws(() => service.query(actor('cliente'), { unassigned: true }), { status: 403 });
});
test('metadatos admiten cliente opcional sin aceptar filtros contradictorios', () => {
  const input = schema.upload.parse({ operationId: '12345678-1234-4234-8234-123456789abc', stationId: '1' });
  assert.equal(input.clientId, null);
  assert.equal(schema.assign.safeParse({ photoId: '1', clientId: null }).success, false);
  assert.equal(schema.query.safeParse({ from: '2026-10-15', to: '2026-10-15', clientId: '1', unassigned: true }).success, false);
});
test('formato por contenido, tamaño máximo y día de carga de Argentina', () => {
  assert.equal(photoFormat({ buffer: Buffer.from([255,216,255,0]) }).mime, 'image/jpeg');
  assert.equal(photoFormat({ buffer: Buffer.from('RIFF0000WEBP') }).mime, 'image/webp');
  assert.throws(() => photoFormat({ buffer: Buffer.from('<svg></svg>'), mimetype: 'image/png' }), { status: 422 });
  assert.throws(() => photoFormat({ buffer: Buffer.alloc(MAX_PHOTO_BYTES + 1) }), { status: 422 });
  assert.equal(businessDate(new Date('2026-10-16T02:59:00Z')), '2026-10-15');
  assert.equal(businessDate(new Date('2026-10-16T03:00:00Z')), '2026-10-16');
});
test('Axios carga binarios por POST sin sobrescribir y reconcilia sólo la ruta indicada', async () => {
  const requests = [], storage = createStorage(env, async config => {
    requests.push(config); return { data: {}, status: 200, headers: {}, config };
  });
  const bytes = Buffer.from([255,216,255,0]);
  await storage.upload('1/test.jpg', bytes, 'image/jpeg'); await storage.remove('1/test.jpg');
  assert.equal(requests[0].method, 'post'); assert.deepEqual(requests[0].data, bytes);
  assert.equal(requests[0].headers['Content-Type'], 'image/jpeg'); assert.equal(requests[0].headers['x-upsert'], 'false');
  assert.equal(requests[0].headers['Cache-Control'], 'max-age=0');
  assert.equal(requests[1].method, 'delete'); assert.deepEqual(JSON.parse(requests[1].data), { prefixes: ['1/test.jpg'] });
});
