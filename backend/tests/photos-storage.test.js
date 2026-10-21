/**
 * @file
 * Verifica archivos y acceso a Storage con dependencias de prueba. Cubre privacidad, formatos
 * y errores del proveedor.
 */
import test, { mock, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { photoService } from '../src/modules/photos/photos.service.js';
import { uploadFile, removeFile, signedUrl, signedPreviewUrl } from '../src/integrations/storage.js';
import sharp from 'sharp';
import { db } from '../src/config/database.js';
after(() => db.end());
import { photoRepository } from '../src/modules/photos/photos.repository.js';
afterEach(() => mock.restoreAll());
import { photoFormat, MAX_PHOTO_BYTES } from '../src/modules/photos/photos.files.js';
import { businessDate } from '../src/modules/photos/photos.upload.js';
import * as schema from '../src/modules/photos/photos.schemas.js';
import { env, actor } from './fixtures.js';

test('cliente no accede a metadatos ni archivos de otro cliente', async () => {
  mock.method(photoRepository, 'find', async () => ({ id: '2', clientId: '9', stationId: '10', file: 'private/photo.jpg' }));
  const request = mock.method(globalThis, 'fetch', async () => Response.json({ signedURL: '/object/sign/foto-ya/foto.jpg?token=example' }));
  const client = actor('cliente', { id: '8', stationId: null });
  await assert.rejects(photoService.detail(client, '2'), { status: 404 });
  await assert.rejects(photoService.access(client, '2'), { status: 404 });
  assert.equal(request.mock.callCount(), 0);
  const ownerClient = { ...client, id: '9' };
  assert.equal((await photoService.detail(ownerClient, '2')).file, undefined);
  await photoService.access(ownerClient, '2');
  assert.equal(request.mock.callCount(), 2);
  assert.throws(() => photoService.query(client, { clientId: '9' }), { status: 403 });
});

test('encargado no obtiene fotos de otro puesto', async () => {
  mock.method(photoRepository, 'find', async () => ({ stationId: '99' }));
  await assert.rejects(photoService.detail(actor('encargado'), '2'), { status: 404 });
});

test('Storage firma por POST y limita la vigencia', async () => {
  const request = mock.method(globalThis, 'fetch', async () => Response.json({ signedURL: '/object/sign/foto-ya/foto.jpg?token=example' }));
  const response = await signedUrl('folder/foto con espacio.jpg');
  const [url, options] = request.mock.calls[0].arguments;
  assert.equal(options.method, 'POST');
  assert.match(String(url), /object\/sign\/foto-ya\/folder\/foto/);
  assert.equal(JSON.parse(options.body).expiresIn, 60);
  assert.equal(response.url, 'https://example.supabase.co/storage/v1/object/sign/foto-ya/foto.jpg?token=example');
  assert.equal(options.redirect, 'error');
});

test('la vista previa genera WebP de hasta 960 px, conserva proporciones y firma sólo la copia privada', async () => {
  const original = await sharp({ create: { width: 1800, height: 1200, channels: 3, background: '#336699' } }).png().toBuffer();
  let uploaded;
  const request = mock.method(globalThis, 'fetch', async (url, options) => {
    if (options.method === 'HEAD') return new Response(null, { status: 404 });
    if (options.method === 'GET') return new Response(original, { headers: { 'content-type': 'image/png' } });
    if (String(url).includes('/object/sign/')) return Response.json({ signedURL: '/object/sign/foto-ya/previews/test.webp?token=example' });
    uploaded = options.body;
    assert.equal(new Headers(options.headers).get('x-upsert'), 'true');
    assert.match(String(url), /previews\/v1\/[a-f0-9]{64}\.webp$/);
    return Response.json({ Key: 'preview' });
  });
  const result = await signedPreviewUrl('private/existing.png');
  const metadata = await sharp(uploaded).metadata();
  assert.equal(metadata.width, 960);
  assert.equal(metadata.height, 640);
  assert.equal(metadata.format, 'webp');
  assert.equal(metadata.exif, undefined);
  assert.match(result.url, /previews/);
  assert.equal(result.expiresIn, 60);
  assert.equal(request.mock.callCount(), 4);
});

test('una vista previa ya generada se reutiliza sin descargar el original', async () => {
  const request = mock.method(globalThis, 'fetch', async (_url, options) => {
    if (options.method === 'HEAD') return new Response(null, { status: 200 });
    assert.equal(options.method, 'POST');
    return Response.json({ signedURL: '/object/sign/foto-ya/previews/test.webp?token=example' });
  });
  await signedPreviewUrl('private/existing.jpg');
  assert.equal(request.mock.callCount(), 2);
});

test('asignación valida y normaliza el mail, y rechaza el antiguo ID', () => {
  assert.deepEqual(schema.assign.parse({ photoId: '1', clientEmail: ' Cliente@Example.com ' }), { photoId: '1', clientEmail: 'cliente@example.com' });
  for (const input of [{ photoId: '1', clientId: '2' }, { photoId: '1', clientEmail: 'incorrecto' }])
    assert.equal(schema.assign.safeParse(input).success, false);
});

test('fallo de Storage no filtra la clave ni el error del proveedor', async () => {
  mock.method(globalThis, 'fetch', async () => Response.json({ message: env.SUPABASE_SECRET_KEY }, { status: 403 }));
  for (const operation of [() => signedUrl('file.jpg'),
    () => uploadFile('file.jpg', Buffer.from([255,216,255,0]), 'image/jpeg'), () => removeFile('file.jpg')]) {
    await assert.rejects(operation(), error => {
      assert.equal(error.status, 502);
      assert.equal(error.code, 'STORAGE_ERROR');
      assert.equal(error.message.includes(env.SUPABASE_SECRET_KEY), false);
      assert.equal(error.message.includes('[object Object]'), false);
      return true;
    });
  }
});

test('rutas privadas inválidas no llegan al proveedor', async () => {
  const request = mock.method(globalThis, 'fetch', () => assert.fail('Ruta inválida'));
  for (const file of ['../other-bucket/a.jpg', '/a.jpg', 'folder/../a.jpg', 'folder\\a.jpg', 'folder//a.jpg'])
    await assert.rejects(signedUrl(file), { status: 502 });
  assert.equal(request.mock.callCount(), 0);
});

test('fotos sin cliente no entregan metadatos ni archivos a ningún cliente', async () => {
  mock.method(photoRepository, 'find', async () => ({ clientId: null, stationId: '10', file: 'private.jpg' }));
  await assert.rejects(photoService.detail(actor('cliente'), '1'), { status: 404 });
  await assert.rejects(photoService.access(actor('cliente'), '1'), { status: 404 });
  assert.throws(() => photoService.query(actor('cliente'), { unassigned: true }), { status: 403 });
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
test('Storage sube sin sobrescribir y elimina sólo la ruta indicada', async () => {
  const request = mock.method(globalThis, 'fetch', async () => Response.json({ Key: '1/test.jpg' }));
  const bytes = Buffer.from([255,216,255,0]);
  await uploadFile('1/test.jpg', bytes, 'image/jpeg');
  await removeFile('1/test.jpg');
  const [, upload] = request.mock.calls[0].arguments;
  assert.equal(upload.method, 'POST');
  assert.deepEqual(upload.body, bytes);
  assert.equal(new Headers(upload.headers).get('content-type'), 'image/jpeg');
  assert.equal(new Headers(upload.headers).get('x-upsert'), 'false');
  const [, removal] = request.mock.calls[1].arguments;
  assert.equal(removal.method, 'DELETE');
  assert.deepEqual(JSON.parse(removal.body), { prefixes: ['1/test.jpg'] });
});
