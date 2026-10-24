/**
 * @file
 * Compara cuerpos del repositorio con validadores del backend. Detecta diferencias de campos y
 * contratos entre capas.
 */
import assert from 'node:assert/strict';
import { before, test, mock, afterEach } from 'node:test';
import { ApiClient, ApiError } from '../src/data/api-client';
import { HttpFotoYaRepository } from '../src/data/http-repository';
import {
  periodError,
  utcInstant,
  displayInstant,
  millisecondsUntilBusinessMidnight,
} from '../src/domain/dates';
import { can, rolePermissions } from '../src/domain/permissions';
import { reportRows, totalMetrics } from '../src/domain/metrics';
import type { PhotoFile } from '../src/domain/models';

// Se usan los validadores reales: las reglas del backend son el contrato.
const backend = '../../backend/src/';
afterEach(() => mock.restoreAll());

function testApi(baseUrl: string, transport: typeof fetch) {
  mock.method(globalThis, 'fetch', transport);
  return new ApiClient(baseUrl);
}

interface Parser {
  parse(value: unknown): unknown;
}
let userSchemas: Record<string, Parser>;
let photoSchemas: Record<string, Parser>;
let periodSchema: Parser, paged: Parser, loginSchema: Parser, empty: Parser;
let backendPermissions: Record<string, string[]>;
let photoFormat: (file: { buffer: Buffer }) => unknown;
before(async () => {
  ({ photoFormat } = await import(backend + 'modules/photos/photos.files.js'));
  userSchemas = await import(backend + 'modules/users/users.schemas.js');
  photoSchemas = await import(backend + 'modules/photos/photos.schemas.js');
  ({ period: periodSchema, paged } = await import(
    backend + 'shared/validation.js'
  ));
  ({ rolePermissions: backendPermissions } = await import(
    backend + 'config/permissions.js'
  ));
  ({ login: loginSchema, empty } = await import(
    backend + 'modules/auth/auth.schemas.js'
  ));
});
const period = { from: '2026-10-15', to: '2026-10-16', stationId: '' };
const spanishRoles = {
  owner: 'dueno',
  manager: 'encargado',
  secretary: 'secretario',
  photographer: 'camarografo',
  seller: 'vendedor',
  client: 'cliente',
  checkin: 'checkin',
};
const actor = (role: string, permissions = backendPermissions[role]) => ({
  id: '7',
  firstName: 'Usuario',
  lastName: 'Prueba',
  dni: '12345678',
  email: 'persona@example.com',
  role,
  roleId: '3',
  stationId: ['dueno', 'secretario', 'cliente'].includes(role) ? null : '1',
  active: true,
  working: true,
  kioskMode: false,
  permissions,
});
const station = {
  id: 1,
  name: 'Puesto',
  address: 'Calle',
  cityId: 2,
  city: 'Ciudad',
  eventId: 3,
  event: 'Evento',
};
const report = {
  stationId: '1',
  station: 'Puesto',
  registeredDays: '2',
  expectedDays: '2',
  taken: '100',
  registeredTaken: '100',
  sold: '70',
  revenue: '1500.20',
  invalidDays: '0',
  discarded: '30',
  percentage: '70.00',
};
const file: PhotoFile = {
  key: '915fa2b7-41ad-4af1-87bd-4285db10bff1',
  name: 'foto.png',
  uri: 'file:///foto.png',
  file: new File(
    [new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10])],
    'foto.png',
    { type: 'image/png' },
  ),
  mimeType: 'image/png',
  size: 12,
};
function fixture(
  role = 'encargado',
  overrides: Record<string, unknown> = {},
  permissions?: string[],
) {
  const requests: {
    path: string;
    body: Record<string, unknown>;
    headers: Headers;
  }[] = [];
  const data: Record<string, unknown> = {
    'auth/login': { token: 't'.repeat(43) },
    'auth/me': actor(role, permissions),
    'catalog/stations': [station],
    'catalog/roles': [
      { id: 3, name: 'vendedor' },
      { id: 6, name: 'cliente' },
    ],
    'users/query': [],
    'reports/days/query': [
      {
        stationId: '1',
        date: '2026-10-15',
        taken: 100,
        sold: '70',
        revenue: '1500.20',
        discarded: '30',
      },
    ],
    'photos/query': [
      {
        id: '91',
        stationId: '1',
        clientId: role === 'cliente' ? '7' : null,
        date: '2026-10-15',
      },
    ],
    'sales/query': [
      {
        id: '2',
        stationId: '1',
        date: '2026-10-15',
        quantity: 70,
        total: '1500.20',
      },
    ],
    'attendance/query': [
      {
        id: '1',
        userId: '7',
        stationId: '1',
        date: '2026-10-15',
        checkIn: '2026-10-15 23:00:00.000000',
        checkOut: '2026-10-16 01:00:00.000000',
      },
    ],
    'attendance/mine': [
      {
        id: '2',
        userId: '7',
        stationId: '2',
        date: '2026-10-15',
        checkIn: '2026-10-15 23:00:00',
        checkOut: null,
      },
    ],
    'reports/query': [report],
    'reports/summary': report,
    'photos/access': { url: 'https://private.example/signed', expiresIn: 60 },
    ...overrides,
  };
  const transport: typeof fetch = async (input, init) => {
    const path = String(input).split('/api/')[1];
    const multipart = init?.body instanceof FormData;
    const body = multipart
      ? Object.fromEntries((init.body as FormData).entries())
      : JSON.parse(String(init?.body));
    requests.push({ path, body, headers: new Headers(init?.headers) });
    assert.equal(init?.method, 'POST');
    assert(!('actorId' in body));
    const schemas: Record<string, { parse: (value: unknown) => unknown }> = {
      'auth/login': loginSchema,
      'auth/me': empty,
      'auth/logout': empty,
      'users/query': userSchemas.query,
      'users/create': userSchemas.create,
      'users/update': userSchemas.update,
      'users/availability': userSchemas.active,
      'reports/days/query': periodSchema,
      'sales/query': periodSchema,
      'photos/query': photoSchemas.query,
      'photos/assign': photoSchemas.assign,
      'photos/access': photoSchemas.detail,
      'attendance/query': periodSchema,
      'attendance/mine': periodSchema,
    };
    schemas[path]?.parse(body);
    if (multipart) {
      const { photo, ...metadata } = body;
      photoSchemas.upload.parse(metadata);
      assert(photo instanceof Blob);
      photoFormat({ buffer: Buffer.from(await photo.arrayBuffer()) });
      assert.equal(new Headers(init?.headers).has('Content-Type'), false);
    }
    const value =
      path === 'catalog/query' ? data[`catalog/${body.resource}`] : data[path];
    return Response.json({ data: value ?? { ok: true } });
  };
  const api = testApi('http://localhost:3000/api/', transport);
  const repo = new HttpFotoYaRepository(api);
  return { api, repo, requests };
}

test('la matriz de fallback coincide con los siete roles del backend', () => {
  for (const [role, spanish] of Object.entries(spanishRoles)) {
    assert.deepEqual(
      [...rolePermissions[role as keyof typeof rolePermissions]].sort(),
      [...backendPermissions[spanish]].sort(),
    );
  }
});

test('login, POST, Bearer, IDs de catálogo, importes y resumen del servidor', async () => {
  const { repo, requests } = fixture();
  await repo.login(' persona@example.com ', 'contraseña');
  const data = await repo.snapshot(period);
  assert.equal(requests[0].headers.has('Authorization'), false);
  assert(
    requests
      .slice(1)
      .every(
        (row) =>
          row.headers.get('Authorization') === `Bearer ${'t'.repeat(43)}`,
      ),
  );
  assert.equal(data.stations[0].id, '1');
  assert.equal(data.employees[0].roleId, 'manager');
  assert.equal(data.summary?.earnings, 1500.2);
  assert.equal(data.summary?.discarded, 30);
  assert.equal(data.attendance[0].checkIn, '2026-10-15T23:00:00.000000Z');
  assert(requests.some((row) => row.path === 'reports/summary'));
  assert(
    requests
      .filter(
        (row) => row.path.endsWith('/query') && row.path !== 'catalog/query',
      )
      .every((row) => row.body.limit === 100 && row.body.offset === 0),
  );
});

test('un cliente sin puesto solo consulta su perfil y sus fotos', async () => {
  const { repo, requests } = fixture('cliente');
  const data = await repo.snapshot(period);
  assert.deepEqual(requests.map((row) => row.path).sort(), [
    'auth/me',
    'photos/query',
  ]);
  assert.equal(data.employees[0].roleId, 'client');
  assert.equal(data.employees[0].stationId, '');
  assert.equal(data.photos[0].clientId, '7');
  assert.equal(data.stations.length, 0);
  assert.equal(data.sales.length, 0);
  assert.equal(can(data.employees[0], 'reports.read'), false);
});

test('camarógrafo recibe vendidas desde conteos sin consultar ventas', async () => {
  const { repo, requests } = fixture('camarografo');
  const data = await repo.snapshot(period);
  const rows = reportRows(data, data.employees[0], {
    ...period,
    to: period.from,
  });
  assert.equal(rows[0].sold, 70);
  assert.equal(rows[0].discarded, 30);
  assert(!requests.some((row) => row.path === 'sales/query'));
  assert(
    !requests.some(
      (row) =>
        row.path.startsWith('reports/') && row.path !== 'reports/days/query',
    ),
  );
});

test('permisos efectivos pueden quitar una capacidad del rol en la siguiente consulta', async () => {
  const { repo, requests } = fixture('encargado', {}, ['photos.read']);
  const data = await repo.snapshot(period);
  assert(!requests.some((row) => row.path === 'users/query'));
  assert.equal(can(data.employees[0], 'employees.manage'), false);
});

test('el alta resuelve rol numérico, conserva password y envía puesto NULL; edición omite password', async () => {
  const { repo, requests } = fixture('dueno');
  const input = {
    firstName: 'Cliente',
    lastName: 'Prueba',
    email: 'cliente@example.com',
    dni: '12345',
    roleId: 'client' as const,
    stationId: '',
    password: 'Contraseña-123456',
  };
  await repo.saveEmployee(input);
  assert.deepEqual(requests.find((row) => row.path === 'users/create')?.body, {
    ...input,
    roleId: '6',
    stationId: null,
  });
  await repo.saveEmployee({ ...input, id: '90' });
  const update = requests.find((row) => row.path === 'users/update')!.body;
  assert.equal(update.userId, '90');
  assert(!('password' in update));
  await repo.setEmployeeActive('90', false);
  assert.deepEqual(requests.at(-1)?.body, { userId: '90', active: false });
});

test('carga multipart envía puesto y cliente sin UUID, y respeta el tamaño máximo', async () => {
  const { repo, requests } = fixture();
  await repo.uploadPhotos('1', [{ ...file, clientId: '42' }]);
  await repo.uploadPhotos('1', [{ ...file, clientId: '42' }]);
  assert.equal(requests[0].body.operationId, undefined);
  assert.equal(requests[0].body.stationId, '1');
  assert.equal(requests[1].body.operationId, undefined);
  assert.equal(requests[0].body.clientId, '42');
  const results = await repo.uploadPhotos('1', [
    { ...file, size: 0 },
    { ...file, size: 6 * 1024 * 1024 + 1 },
  ]);
  assert(results.every((row) => row.error));
  assert.equal(requests.length, 2);
});

test('fallo parcial no se presenta como éxito y se puede enviar una nueva carga', async () => {
  let attempt = 0;
  const requests: FormData[] = [];
  const api = testApi('http://api.test/api', async (_url, init) => {
    requests.push(init?.body as FormData);
    attempt++;
    return attempt === 1
      ? Response.json(
          {
            error: {
              code: 'STORAGE_ERROR',
              message: 'No se pudo guardar la foto.',
            },
          },
          { status: 502 },
        )
      : Response.json({ data: { id: '1' } });
  });
  const repo = new HttpFotoYaRepository(api);
  assert((await repo.uploadPhotos('1', [file]))[0].error);
  assert.equal((await repo.uploadPhotos('1', [file]))[0].error, undefined);
  assert.equal(requests[0].has('operationId'), false);
  assert.equal(requests[1].has('operationId'), false);
  assert(requests.every((request) => request.get('photo') instanceof Blob));
});

test('cada apertura obtiene acceso temporal; asignación no envía metadatos inventados', async () => {
  const { repo, requests } = fixture();
  await repo.accessPhoto('91');
  await repo.accessPhoto('91');
  await repo.assignPhoto('91', ' Cliente@Example.com ');
  assert.deepEqual(
    requests.map((row) => row.body),
    [
      { photoId: '91' },
      { photoId: '91' },
      { photoId: '91', clientEmail: 'cliente@example.com' },
    ],
  );
});

test('desde ventas guarda el mail por la ruta del evento y consulta una foto elegida fuera de la primera página', async () => {
  const requests: { path: string; body: Record<string, unknown> }[] = [];
  const repo = new HttpFotoYaRepository(
    testApi('https://api.example.com/api', async (url, options) => {
      const path = String(url).split('/api/')[1];
      requests.push({ path, body: JSON.parse(String(options?.body)) });
      return Response.json({
        data:
          path === 'sales/photos'
            ? []
            : { clientEmail: 'cliente@example.com', clientId: null },
      });
    }),
  );
  const result = await repo.assignPhoto('91', 'Cliente@Example.com', true);
  assert.equal(result.clientEmail, 'cliente@example.com');
  await repo.salePhotos('1', 0, '91');
  await repo.accessSoldPhoto('25', '91');
  assert.deepEqual(requests, [
    {
      path: 'sales/photos/assign',
      body: { photoId: '91', clientEmail: 'cliente@example.com' },
    },
    {
      path: 'sales/photos',
      body: { stationId: '1', limit: 12, offset: 0, photoId: '91' },
    },
    { path: 'sales/photos/sold/access', body: { saleId: '25', photoId: '91' } },
  ]);
});

test('paginación recorre todos los bloques y conserva filtros sin truncar totales', async () => {
  const bodies: Record<string, unknown>[] = [];
  const api = testApi('http://api.test/api', async (_input, init) => {
    const body = JSON.parse(String(init?.body));
    bodies.push(body);
    paged.parse({ limit: body.limit, offset: body.offset });
    return Response.json({
      data: Array.from({ length: body.offset === 0 ? 100 : 2 }, (_, index) => ({
        id: body.offset + index,
      })),
    });
  });
  const rows = await api.all('photos/query', {
    from: period.from,
    to: period.to,
  });
  assert.equal(rows.length, 102);
  assert.deepEqual(
    bodies.map((row) => row.offset),
    [0, 100],
  );
  assert(bodies.every((row) => row.from === period.from));
});

test('un fallo de página no devuelve una lista parcial', async () => {
  const api = testApi('http://api.test/api', async (_input, init) =>
    JSON.parse(String(init?.body)).offset === 0
      ? Response.json({ data: new Array(100).fill({ id: '1' }) })
      : Response.json(
          { error: { code: 'DB_ERROR', message: 'Fallo de consulta' } },
          { status: 500 },
        ),
  );
  await assert.rejects(api.all('users/query'), /Fallo de consulta/);
});

test('solo una sesión inválida borra el token; contraseña actual incorrecta no desloguea', async () => {
  let code = 'REQUEST_ERROR',
    invalidated = 0;
  const api = testApi('http://api.test/api', async () =>
    Response.json(
      { error: { code, message: 'Error de prueba' } },
      { status: 401 },
    ),
  );
  api.setToken('session');
  api.onUnauthorized = () => invalidated++;
  await assert.rejects(api.post('auth/password/change'), ApiError);
  assert.equal(invalidated, 0);
  code = 'UNAUTHENTICATED';
  await assert.rejects(api.post('auth/me'), ApiError);
  await assert.rejects(api.post('auth/me'), ApiError);
  assert.equal(invalidated, 1);
});

test('respuestas en vuelo de una sesión anterior no restauran sus datos', async () => {
  let finish!: (response: Response) => void;
  const api = testApi(
    'http://api.test/api',
    () =>
      new Promise((resolve) => {
        finish = resolve;
      }),
  );
  api.setToken('old');
  const request = api.post('auth/me');
  api.setToken('new');
  finish(Response.json({ data: actor('dueno') }));
  await assert.rejects(
    request,
    (error: ApiError) => error.code === 'SESSION_CHANGED',
  );
});

test('informes conservan NULL y días inconsistentes aunque el saldo agregado sea positivo', async () => {
  const { repo } = fixture('encargado', {
    'reports/query': [
      {
        ...report,
        taken: '100',
        sold: '90',
        invalidDays: '1',
        discarded: null,
        percentage: null,
      },
    ],
    'reports/summary': {
      ...report,
      taken: '100',
      sold: '90',
      discarded: null,
      percentage: null,
    },
  });
  const data = await repo.snapshot(period);
  const rows = reportRows(data, data.employees[0], period);
  assert.equal(rows[0].invalidDays, 1);
  assert.equal(data.summary?.discarded, null);
  assert.equal(totalMetrics(rows).discarded, null);
  assert.equal(totalMetrics(rows).percentage, null);
});

test('filtros de ciudad/evento usan IDs del catálogo y asistencia propia usa puesto histórico', async () => {
  const { repo, requests } = fixture('secretario');
  const data = await repo.snapshot(
    { ...period, city: 'Ciudad', event: 'Evento' },
    true,
  );
  const report = requests.find((row) => row.path === 'reports/query')!;
  assert.equal(report.body.cityId, '2');
  assert.equal(report.body.eventId, '3');
  assert(!('city' in report.body));
  assert(!('event' in report.body));
  assert(requests.some((row) => row.path === 'attendance/mine'));
  assert(!requests.some((row) => row.path === 'attendance/query'));
  assert.equal(data.attendance[0].stationId, '2');
});

test('fechas MySQL se interpretan como UTC y los períodos respetan 367 días', () => {
  assert.equal(utcInstant('2026-10-16 01:00:00'), '2026-10-16T01:00:00Z');
  assert.equal(
    displayInstant('2026-10-16 01:00:00'),
    displayInstant('2026-10-16T01:00:00Z'),
  );
  assert.equal(periodError('2026-01-01', '2027-01-02'), '');
  assert.match(periodError('2026-01-01', '2027-01-03'), /367/);
});

test('check-in conserva la sesión y envía credenciales del empleado y estado esperado', async () => {
  const { repo, requests } = fixture('checkin', {
    'attendance/kiosk/employees': [
      {
        id: 8,
        firstName: 'Ana',
        lastName: 'Pérez',
        working: false,
        attendanceId: null,
      },
    ],
  });
  await repo.login('checkin@example.com', 'clave');
  const [employee] = await repo.checkInEmployees();
  assert.equal(employee.id, '8');
  await repo.markAttendance(
    employee,
    ' empleado@example.com ',
    'clave-empleado',
  );
  await repo.markAttendance(
    { ...employee, working: true, attendanceId: '22' },
    'empleado@example.com',
    'clave-empleado',
  );
  await repo.assignCheckIn('2', 'clave-checkin');
  await repo.logoutCheckIn('clave-checkin');
  assert.deepEqual(
    requests.find((row) => row.path === 'attendance/kiosk/assign')?.body,
    { stationId: '2', password: 'clave-checkin' },
  );
  assert.deepEqual(
    requests.find((row) => row.path === 'attendance/kiosk/exit')?.body,
    { password: 'clave-checkin' },
  );
  const marks = requests.filter((row) => row.path === 'attendance/kiosk/mark');
  assert.deepEqual(marks[0].body, {
    userId: '8',
    email: 'empleado@example.com',
    password: 'clave-empleado',
    action: 'check-in',
    attendanceId: null,
  });
  assert.equal(marks[1].body.action, 'check-out');
  assert.equal(marks[1].body.attendanceId, '22');
  assert(
    requests
      .slice(1)
      .every(
        (row) =>
          row.headers.get('Authorization') === `Bearer ${'t'.repeat(43)}`,
      ),
  );
});

test('sin check-in o en modo check-in el snapshot solo consulta el perfil', async () => {
  for (const role of ['camarografo', 'vendedor', 'secretario', 'checkin']) {
    const { repo, requests } = fixture(role, {
      'auth/me': {
        ...actor(role),
        working: false,
        kioskMode: role === 'checkin',
      },
    });
    const data = await repo.snapshot();
    assert.deepEqual(
      requests.map((row) => row.path),
      ['auth/me'],
    );
    assert.equal(data.photos.length, 0);
    assert.equal(data.stations.length, 0);
    assert.equal(can(data.employees[0], 'photos.read'), false);
  }
});

test('ventas envía foto, tarifas, copias, pago y UUID; el servidor calcula el importe', async () => {
  const { repo, requests } = fixture();
  const input = {
    operationId: '73ddf539-013b-4200-b7a9-96e43f8f1a31',
    stationId: '1',
    photoId: '42',
    paymentMethod: 'transferencia' as const,
    prices: [
      { priceId: '3', copies: 4 },
      { priceId: '5', copies: 2 },
    ],
  };
  await repo.recordSale(input);
  assert.equal(requests[0].path, 'sales/create');
  assert.deepEqual(requests[0].body, input);
});

test('precios administra tarifas por puesto sin enviar permisos de gestión de puestos', async () => {
  const { repo, requests } = fixture('encargado', {
    'catalog/prices/query': [
      { id: 1, stationId: 1, amount: '10.00', name: 'Copia', active: 0 },
    ],
  });
  const prices = await repo.stationPrices('1');
  assert.deepEqual(prices, [
    { id: '1', stationId: '1', amount: '10.00', name: 'Copia', active: false },
  ]);
  await repo.createPrice('1', 'Nueva', '20.00');
  await repo.updatePrice('1', '1', 'Grande', '30.00');
  await repo.setPriceActive('1', '1', false);
  assert.deepEqual(
    requests.slice(1).map(({ path, body }) => ({ path, body })),
    [
      {
        path: 'catalog/prices/create',
        body: { stationId: '1', name: 'Nueva', amount: '20.00' },
      },
      {
        path: 'catalog/prices/update',
        body: { stationId: '1', priceId: '1', name: 'Grande', amount: '30.00' },
      },
      {
        path: 'catalog/prices/availability',
        body: { stationId: '1', priceId: '1', active: false },
      },
    ],
  );
});

test('la lista de venta cambia de día a medianoche de Argentina', () => {
  assert.equal(
    millisecondsUntilBusinessMidnight(new Date('2026-10-18T02:59:59.999Z')),
    1,
  );
  assert.equal(
    millisecondsUntilBusinessMidnight(new Date('2026-10-18T03:00:00Z')),
    86400000,
  );
  assert.equal(
    millisecondsUntilBusinessMidnight(new Date('2026-10-17T23:00:00Z')),
    14400000,
  );
});

test('conteos del camarógrafo no compensan días con sobreventa entre sí', async () => {
  const { repo } = fixture('camarografo', {
    'reports/days/query': [
      {
        stationId: '1',
        date: '2026-10-15',
        taken: 5,
        sold: '10',
        revenue: '100',
        discarded: null,
      },
      {
        stationId: '1',
        date: '2026-10-16',
        taken: 95,
        sold: '80',
        revenue: '800',
        discarded: '15',
      },
    ],
  });
  const data = await repo.snapshot(period);
  const rows = reportRows(data, data.employees[0], period);
  assert.equal(rows[0].taken, 100);
  assert.equal(rows[0].sold, 90);
  assert.equal(rows[0].invalidDays, 1);
  assert.equal(rows[0].discarded, null);
});

test('filtros por IDs distinguen ciudades y eventos con el mismo nombre', async () => {
  const { repo, requests } = fixture('dueno', {
    'catalog/stations': [station, { ...station, id: 2, cityId: 4, eventId: 5 }],
  });
  const selected = { ...period, city: '4', event: '5' };
  const data = await repo.snapshot(selected);
  assert.equal(
    requests.find((row) => row.path === 'reports/summary')?.body.cityId,
    '4',
  );
  assert.equal(
    requests.find((row) => row.path === 'reports/summary')?.body.eventId,
    '5',
  );
  assert.deepEqual(
    reportRows(data, data.employees[0], selected).map((row) => row.station.id),
    ['2'],
  );
});

test('una imagen válida no se rechaza solo por su extensión o MIME declarado', async () => {
  const { repo, requests } = fixture();
  const results = await repo.uploadPhotos('1', [
    { ...file, name: 'imagen.dat', mimeType: 'application/octet-stream' },
  ]);
  assert.equal(results[0].error, undefined);
  assert.equal(requests.length, 1);
});

test('alta Check-in solo envía correo y contraseña sin consultar catálogos', async () => {
  const { repo, requests } = fixture();
  await repo.saveEmployee({
    firstName: '',
    lastName: '',
    dni: '',
    stationId: '',
    roleId: 'checkin',
    email: 'kiosk@example.com',
    password: 'Test-password-1234',
  });
  assert.deepEqual(
    requests.map((row) => row.path),
    ['users/check-in/create'],
  );
  assert.deepEqual(requests[0].body, {
    email: 'kiosk@example.com',
    password: 'Test-password-1234',
  });
  userSchemas.createCheckIn.parse(requests[0].body);
});

test('contraseña errónea al cerrar Check-in conserva la sesión', async () => {
  const api = testApi('http://api.test/api', async (_url, init) => {
    assert.equal(
      (init?.headers as Record<string, string>).Authorization,
      `Bearer ${'t'.repeat(43)}`,
    );
    return Response.json(
      {
        error: {
          code: 'INVALID_CREDENTIALS',
          message: 'Contraseña incorrecta',
        },
      },
      { status: 401 },
    );
  });
  const repo = new HttpFotoYaRepository(api);
  await repo.acceptSession('t'.repeat(43));
  await assert.rejects(repo.logoutCheckIn('incorrecta'));
  await assert.rejects(repo.logoutCheckIn('incorrecta'));
});

test('gráficos normaliza agregados, horas y turnos sin inventar autores; el encargado envía solo su puesto', async () => {
  const { repo, requests } = fixture('encargado', {
    'reports/graphics/query': {
      days: [
        {
          stationId: 1,
          date: period.from,
          taken: '10',
          sold: '2',
          sales: '3',
          earnings: '1500.20',
        },
      ],
      hours: [
        {
          stationId: 1,
          hour: '12',
          taken: '4',
          sold: '2',
          sales: '3',
          earnings: '1500.20',
        },
        {
          stationId: 1,
          hour: null,
          taken: '6',
          sold: '0',
          sales: '0',
          earnings: '0',
        },
      ],
      people: [
        {
          stationId: 1,
          employeeId: null,
          name: 'Sin autor',
          role: 'photographer',
          taken: '10',
          sold: '2',
          sales: '3',
          earnings: '1500.20',
        },
      ],
      workers: [
        {
          stationId: 1,
          employeeId: 7,
          name: 'Persona',
          role: 'seller',
          opportunityTaken: '4',
          missingTimes: '6',
        },
      ],
      attendance: [
        {
          id: 1,
          employeeId: 7,
          stationId: 1,
          name: 'Persona',
          role: 'vendedor',
          checkIn: '2026-10-15 15:00:00',
          checkOut: null,
        },
      ],
    },
  });
  const data = await repo.graphics(
    { ...period, stationId: '999', city: 'another-city' },
    period.from,
  );
  assert.deepEqual(
    requests.find((r) => r.path === 'reports/graphics/query')?.body,
    { from: period.from, to: period.to, stationId: '1', day: period.from },
  );
  assert.equal(data.days[0].earnings, 1500.2);
  assert.equal(data.days[0].sales, 3);
  assert.equal(data.hours[0].hour, 12);
  assert.equal(data.hours[1].hour, null);
  assert.equal(data.people[0].employeeId, null);
  assert.equal(data.workers[0].opportunityTaken, 4);
  assert.equal(data.attendance[0].checkIn, '2026-10-15T15:00:00Z');
  assert.equal(data.attendance[0].checkOut, null);
});

test('snapshot del encargado descarta catálogos ajenos y fija su puesto aunque el filtro venga de una URL', async () => {
  const { repo, requests } = fixture('encargado', {
    'catalog/stations': [station, { ...station, id: 999, name: 'Otro puesto' }],
  });
  const data = await repo.snapshot({
    ...period,
    stationId: '999',
    city: 'otra',
    event: 'otro',
  });
  assert.deepEqual(
    data.stations.map((s) => s.id),
    ['1'],
  );
  for (const request of requests.filter((r) =>
    [
      'reports/query',
      'reports/summary',
      'reports/days/query',
      'sales/query',
      'photos/query',
      'attendance/query',
    ].includes(r.path),
  )) {
    assert.equal(request.body.stationId, '1');
    assert.equal(request.body.cityId, undefined);
    assert.equal(request.body.eventId, undefined);
  }
});
