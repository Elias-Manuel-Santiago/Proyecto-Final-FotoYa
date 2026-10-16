import assert from 'node:assert/strict';
import test from 'node:test';
import { ApiClient, ApiError } from '../src/data/api-client';

// Solo consultas públicas y rechazos: no crea usuarios, sesiones ni operaciones.
const live = { skip: process.env.FOTO_YA_LIVE_TESTS !== '1' };
const baseUrl = process.env.EXPO_PUBLIC_API_URL ?? 'http://127.0.0.1:3000/api';

test(
  'API real: health POST responde con el envelope esperado',
  live,
  async () => {
    const api = new ApiClient(baseUrl);
    const data = await api.post('health');
    assert(data && typeof data === 'object');
  },
);

test('API real: CORS admite el origen del frontend web', live, async () => {
  const response = await fetch(`${baseUrl}/health`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Origin: 'http://localhost:8081',
    },
    body: '{}',
  });
  assert.equal(response.status, 200);
  assert.equal(
    response.headers.get('access-control-allow-origin'),
    'http://localhost:8081',
  );
});

test(
  'API real: el cliente HTTP interpreta rechazos de sesión y credenciales',
  live,
  async () => {
    const api = new ApiClient(baseUrl);
    await assert.rejects(
      api.post('auth/me'),
      (error: ApiError) =>
        error.status === 401 && error.code === 'UNAUTHENTICATED',
    );
    await assert.rejects(
      api.post('auth/login', {
        email: `contract-check-${Date.now()}@example.invalid`,
        password: 'Not-a-real-password-123',
      }),
      (error: ApiError) =>
        error.status === 401 && error.code === 'INVALID_CREDENTIALS',
    );
  },
);
