import assert from 'node:assert/strict';
import { afterEach, mock, test } from 'node:test';
import { ApiClient, ApiError } from '../src/data/api-client';
import { HttpFotoYaRepository } from '../src/data/http-repository';
import {
  orderedSessionStorage,
  sessionStorageKey,
} from '../src/data/session-persistence';
import { createSessionStorage } from '../src/data/session-storage';

afterEach(() => mock.restoreAll());
const token = 'a'.repeat(43);
const url = 'https://api.example.com/api';
function storage(initial: string | null = null) {
  let value = initial;
  return orderedSessionStorage({
    async read() {
      return value;
    },
    async write(next) {
      value = next;
    },
  });
}
const actor = (role: string, kioskMode = false) => ({
  id: '1',
  firstName: 'Usuario',
  lastName: 'Prueba',
  dni: '12345678',
  email: 'usuario@example.com',
  role,
  roleId: '1',
  stationId: '1',
  active: true,
  working: false,
  kioskMode,
  permissions: [],
});

for (const role of [
  'dueno',
  'encargado',
  'secretario',
  'camarografo',
  'vendedor',
  'cliente',
]) {
  test(`recupera la sesión de ${role} y consulta su estado vigente al servidor`, async () => {
    const saved = storage();
    const profile = actor(role, role === 'encargado');
    mock.method(
      globalThis,
      'fetch',
      async (input: string, init: RequestInit) => {
        if (input.endsWith('/auth/login'))
          return Response.json({ data: { token } });
        assert.equal(input, `${url}/auth/me`);
        assert.equal(
          (init.headers as Record<string, string>).Authorization,
          `Bearer ${token}`,
        );
        return Response.json({ data: profile });
      },
    );
    const first = new HttpFotoYaRepository(new ApiClient(url), saved);
    await first.login('usuario@example.com', 'contraseña de prueba');
    const restarted = new HttpFotoYaRepository(new ApiClient(url), saved);
    assert.equal(await restarted.restoreSession(), true);
    let received;
    restarted.setOnProfile((employee) => {
      received = employee;
    });
    const data = await restarted.snapshot();
    assert.equal(data.employees[0].kioskMode, profile.kioskMode);
    assert.equal(data.employees[0].working, false);
    assert.deepEqual(received, data.employees[0]);
  });
}

test('persiste también las sesiones aceptadas desde registro o login social', async () => {
  const saved = storage();
  await new HttpFotoYaRepository(new ApiClient(url), saved).acceptSession(
    token,
  );
  assert.equal(await saved.read(), token);
  assert.equal(
    await new HttpFotoYaRepository(new ApiClient(url), saved).restoreSession(),
    true,
  );
});

test('logout borra la sesión persistida aunque el servidor no esté accesible', async () => {
  const saved = storage(token);
  const repository = new HttpFotoYaRepository(new ApiClient(url), saved);
  await repository.restoreSession();
  mock.method(globalThis, 'fetch', async () => {
    throw new Error('offline');
  });
  await assert.rejects(repository.logout());
  assert.equal(await saved.read(), null);
  assert.equal(await repository.restoreSession(), false);
});

test('una sesión revocada o vencida se elimina al recibir UNAUTHENTICATED', async () => {
  const saved = storage(token);
  const api = new ApiClient(url);
  const repository = new HttpFotoYaRepository(api, saved);
  let removal: Promise<void> | undefined;
  api.setOnUnauthorized(() => {
    removal = repository.clearSession();
  });
  await repository.restoreSession();
  mock.method(globalThis, 'fetch', async () =>
    Response.json(
      {
        error: { code: 'UNAUTHENTICATED', message: 'Sesión revocada' },
      },
      { status: 401 },
    ),
  );
  await assert.rejects(
    repository.profile(),
    (error: unknown) =>
      error instanceof ApiError && error.code === 'UNAUTHENTICATED',
  );
  await removal;
  assert.equal(await saved.read(), null);
});

test('un fallo temporal conserva el token y permite recuperar la sesión al reintentar', async () => {
  const saved = storage(token);
  const repository = new HttpFotoYaRepository(new ApiClient(url), saved);
  await repository.restoreSession();
  const transport = mock.method(globalThis, 'fetch', async () => {
    throw new Error('offline');
  });
  await assert.rejects(repository.snapshot());
  assert.equal(await saved.read(), token);
  transport.mock.mockImplementation(async () =>
    Response.json({ data: actor('cliente') }),
  );
  assert.equal((await repository.snapshot()).employees[0].roleId, 'client');
});

test('descarta tokens corruptos y una lectura tardía no restaura una sesión cerrada', async () => {
  const saved = storage('inválido');
  const repository = new HttpFotoYaRepository(new ApiClient(url), saved);
  assert.equal(await repository.restoreSession(), false);
  assert.equal(await saved.read(), null);
  let resolve!: (value: string) => void;
  const delayed = new HttpFotoYaRepository(new ApiClient(url), {
    read: () =>
      new Promise<string>((done) => {
        resolve = done;
      }),
    async write() {},
  });
  const restore = delayed.restoreSession();
  await delayed.clearSession();
  resolve(token);
  assert.equal(await restore, false);
});

test('ordena el borrado posterior a un guardado pendiente', async () => {
  let finish!: () => void;
  let value: string | null = null;
  const saved = orderedSessionStorage({
    async read() {
      return value;
    },
    async write(next) {
      if (next)
        await new Promise<void>((done) => {
          finish = done;
        });
      value = next;
    },
  });
  const write = saved.write(token);
  await Promise.resolve();
  const clear = saved.write(null);
  finish();
  await Promise.all([write, clear]);
  assert.equal(await saved.read(), null);
});

test('web guarda únicamente el token, lo recupera y aísla distintas APIs', async () => {
  const values = new Map<string, string>();
  const originalWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  Object.defineProperty(globalThis, 'window', {
    configurable: true,
    value: {
      localStorage: {
        getItem: (key: string) => values.get(key) ?? null,
        setItem: (key: string, value: string) => values.set(key, value),
        removeItem: (key: string) => values.delete(key),
      },
    },
  });
  try {
    await createSessionStorage(url).write(token);
    assert.equal(await createSessionStorage(`${url}/`).read(), token);
    assert.equal(
      await createSessionStorage('https://otra-api.example.com/api').read(),
      null,
    );
    assert.deepEqual([...values.values()], [token]);
    await createSessionStorage(url).write(null);
    assert.equal(values.size, 0);
    assert.match(sessionStorageKey(url), /^[\w.-]+$/);
  } finally {
    if (originalWindow)
      Object.defineProperty(globalThis, 'window', originalWindow);
    else Reflect.deleteProperty(globalThis, 'window');
  }
});
