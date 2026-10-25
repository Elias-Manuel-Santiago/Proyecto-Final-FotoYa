import { test, beforeEach, afterEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { gzipSync } from 'node:zlib';
import { env } from '../src/config/env.js';
import { db } from '../src/config/database.js';
import { createAuth0Directory } from '../src/integrations/auth0-directory.js';
import { userService } from '../src/modules/users/users.service.js';

let previous;
beforeEach(() => {
  previous = { ...env };
  Object.assign(env, { AUTH0_DOMAIN: 'test.auth0.com', AUTH0_MANAGEMENT_CLIENT_ID: 'm2m', AUTH0_MANAGEMENT_CLIENT_SECRET: 'secret' });
});
afterEach(() => Object.assign(env, previous));
after(() => db.end());
const account = id => ({ user_id: `amazon|${id}`, email: `${id}@example.com`, name: 'Amazon User',
  identities: [{ provider: 'amazon', user_id: String(id), connection: 'amazon', access_token: 'private' }],
  app_metadata: { secret: 'private' } });
const json = data => new Response(JSON.stringify(data), { headers: { 'Content-Type': 'application/json' } });

test('directorio exclusivo del dueño, incluso si otro rol tiene employees.read', async () => {
  for (const role of ['secretario', 'encargado', 'cliente'])
    await assert.rejects(userService.auth0Users({ role, permissions: ['employees.read'] }), { status: 403 });
});

test('sin credenciales el directorio falla explícitamente y no intenta salir a la red', async () => {
  env.AUTH0_MANAGEMENT_CLIENT_SECRET = '';
  const directory = createAuth0Directory({ fetchImpl: () => assert.fail('No debe consultar') });
  await assert.rejects(directory.query(), { code: 'AUTH0_DIRECTORY_NOT_CONFIGURED' });
});

test('pagina todo el tenant, comparte solicitudes concurrentes, cachea y omite secretos', async () => {
  const calls = [];
  const directory = createAuth0Directory({ fetchImpl: async (url, options) => {
    calls.push({ url, options });
    if (url.endsWith('/oauth/token')) return json({ access_token: 'management-token', expires_in: 3600 });
    const page = new URL(url).searchParams.get('page');
    return json({ total: 101, users: page === '0' ? Array.from({ length: 100 }, (_, i) => account(i)) : [account(100)] });
  } });
  const [first, second] = await Promise.all([directory.query(), directory.query()]);
  assert.deepEqual(first, { status: 'pending' });
  assert.deepEqual(second, first);
  const result = await directory.query();
  assert.equal(result.users.length, 101);
  assert.deepEqual(result.users[0].authenticationProviders, ['amazon']);
  assert.equal(JSON.stringify(result).includes('private'), false);
  assert.deepEqual(await directory.query(), result);
  assert.equal(calls.length, 3);
  const grant = JSON.parse(calls[0].options.body);
  assert.equal(grant.audience, 'https://test.auth0.com/api/v2/');
  assert.equal(calls[1].options.headers.Authorization, 'Bearer management-token');
});

test('al alcanzar el límite de búsqueda usa exportación completa y decodifica NDJSON gzip', async () => {
  let exported = false, downloaded = false;
  const directory = createAuth0Directory({ fetchImpl: async (url, options) => {
    if (url.endsWith('/oauth/token')) return json({ access_token: 'token' });
    if (url.includes('/users?')) return json({ total: 1000, users: [account(1)] });
    if (url.endsWith('/jobs/users-exports')) {
      const body = JSON.parse(options.body);
      assert.equal(body.connection_id, undefined);
      assert.equal(body.limit, undefined);
      exported = true;
      return json({ id: 'job_1' });
    }
    if (url.endsWith('/jobs/job_1')) return json({ status: 'completed', location: 'https://export.example/users.gz' });
    assert.equal(options.headers, undefined); // No filtrar token al host del archivo.
    downloaded = true;
    return new Response(gzipSync(Array.from({ length: 1001 }, (_, i) => JSON.stringify(account(i))).join('\n')));
  } });
  assert.deepEqual(await directory.query(), { status: 'pending' });
  const result = await directory.query();
  assert.equal(result.users.length, 1001);
  assert(exported && downloaded);
});

test('un fallo de Auth0 no entrega una lista parcial ni expone la respuesta del proveedor', async () => {
  const directory = createAuth0Directory({ fetchImpl: async url => url.endsWith('/oauth/token')
    ? json({ access_token: 'token' }) : new Response('secret-provider-error', { status: 403 }) });
  await assert.rejects(directory.query(), error => {
    assert.equal(error.code, 'AUTH0_DIRECTORY_UNAVAILABLE');
    assert(!error.message.includes('secret-provider-error'));
    return true;
  });
});
