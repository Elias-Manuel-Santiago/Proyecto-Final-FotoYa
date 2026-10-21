/**
 * @file
 * Verifica solicitudes HTTP y errores web. Cubre transporte y contratos del cliente según los
 * escenarios de la suite.
 */
import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiClient } from '../src/data/api-client';

test('el transporte predeterminado respeta el contexto del fetch del navegador', async () => {
  const originalFetch = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = async function (this: unknown, input, init) {
    // Los navegadores rechazan fetch cuando se invoca como método de ApiClient.
    if (this !== undefined && this !== globalThis)
      throw new TypeError('Illegal invocation');
    calls += 1;
    assert.equal(input, 'https://api.example.com/api/health');
    assert.equal(init?.method, 'POST');
    return Response.json({ data: { status: 'ok' } });
  };
  try {
    const api = new ApiClient('https://api.example.com/api');
    assert.deepEqual(await api.post('health'), { status: 'ok' });
    assert.equal(calls, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
