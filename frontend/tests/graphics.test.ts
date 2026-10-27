import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  dailyValues,
  graphicDates,
  graphicScopes,
  graphicValue,
  hourlyValues,
  peopleValues,
  periodDates,
  sumGraphicValues,
  workersAtHour,
  type GraphicsData,
} from '../src/domain/graphics';
import type { Station } from '../src/domain/models';

const stations: Station[] = [
  {
    id: '1',
    name: 'Uno',
    city: 'Ciudad',
    cityId: '10',
    event: 'Feria',
    eventId: '20',
  },
  {
    id: '2',
    name: 'Dos',
    city: 'Ciudad',
    cityId: '11',
    event: 'Feria',
    eventId: '21',
  },
];
const empty: GraphicsData = {
  days: [],
  hours: [],
  people: [],
  workers: [],
  attendance: [],
};
const values = { earnings: 120, sales: 3, sold: 2, taken: 10 };

test('Siempre grafica todo el historial sin truncar a 367 días ni depender de las fechas anteriores', () => {
  const dates = Array.from({ length: 400 }, (_, index) =>
    new Date(Date.parse('2020-01-01T12:00:00Z') + index * 86400000)
      .toISOString()
      .slice(0, 10),
  );
  const data = {
    ...empty,
    days: dates.toReversed().flatMap((date) => [
      { ...values, date, stationId: '1' },
      { ...values, date, stationId: '2' },
    ]),
  };
  const period = { from: '2026-10-01', to: '2026-10-02', stationId: '' };
  assert.deepEqual(graphicDates(data, { ...period, allTime: true }), dates);
  assert.deepEqual(graphicDates(empty, { ...period, allTime: true }), []);
  assert.deepEqual(graphicDates(data, period), ['2026-10-01', '2026-10-02']);
});

test('series independientes por ID y alcance: nombres iguales no mezclan ciudades; encargado solo tiene su puesto', () => {
  const scopes = graphicScopes(stations);
  assert.deepEqual(scopes.find((s) => s.id === 'city:10')?.stationIds, ['1']);
  assert.deepEqual(scopes.find((s) => s.id === 'event:21')?.stationIds, ['2']);
  assert.deepEqual(
    graphicScopes([stations[0]], true).map((s) => s.id),
    ['station:1'],
  );
  assert.deepEqual(
    graphicScopes(stations).find((s) => s.id === 'total')?.stationIds,
    ['1', '2'],
  );
});

test('operaciones y familias compradoras son distintas; promedios y porcentajes se calculan sobre las sumas', () => {
  const combined = sumGraphicValues([
    values,
    { earnings: 80, sales: 1, sold: 1, taken: 90 },
  ]);
  assert.equal(graphicValue(combined, 'average'), 50);
  assert.equal(graphicValue(combined, 'percentage'), 3);
  assert.equal(graphicValue(values, 'sales'), 3);
  assert.equal(graphicValue({ ...values, sales: 0 }, 'average'), null);
  assert.equal(
    graphicValue(
      sumGraphicValues([{ ...values, taken: 1 }, values]),
      'percentage',
    ),
    null,
  );
});

test('un día ausente conserva ingresos cero y conteo desconocido; no se convierte una serie incompleta en cero', () => {
  const data = {
    ...empty,
    days: [{ ...values, date: '2026-10-24', stationId: '1' }],
  };
  const total = graphicScopes(stations)[0];
  assert.equal(dailyValues(data, total, '2026-10-24').taken, null);
  assert.equal(dailyValues(data, total, '2026-10-24').earnings, 120);
  assert.equal(
    dailyValues(data, { ...total, stationIds: ['1'] }, '2026-10-24').taken,
    10,
  );
  assert.equal(dailyValues(data, total, '2026-10-23').taken, null);
  assert.equal(periodDates('2026-10-01', '2026-10-31').length, 31);
});

test('los datos históricos sin hora no se distribuyen artificialmente y bloquean porcentajes horarios incompletos', () => {
  const data = {
    ...empty,
    days: [{ ...values, date: '2026-10-24', stationId: '1' }],
    hours: [
      { ...values, taken: 2, stationId: '1', hour: 12 },
      { earnings: 0, sales: 0, sold: 0, taken: 8, stationId: '1', hour: null },
    ],
  };
  const scope = graphicScopes([stations[0]])[0];
  assert.equal(hourlyValues(data, scope, '2026-10-24', 12).taken, null);
  assert.equal(hourlyValues(data, scope, '2026-10-24', null).taken, 8);
  assert.equal(hourlyValues(data, scope, '2026-10-24', 11).earnings, 0);
});

test('la hora incluye turnos cruzando medianoche, excluye bordes exactos y otros puestos', () => {
  const shift = {
    id: '1',
    employeeId: '7',
    stationId: '1',
    name: 'Persona',
    role: 'vendedor',
    checkIn: '2026-10-24T23:00:00Z',
    checkOut: '2026-10-25T04:00:00Z',
    closedAt: null,
  };
  assert.equal(workersAtHour([shift], ['1'], '2026-10-25', 0).length, 1);
  assert.equal(workersAtHour([shift], ['1'], '2026-10-25', 1).length, 0);
  assert.equal(workersAtHour([shift], ['2'], '2026-10-25', 0).length, 0);
  const missed = { ...shift, checkOut: null, closedAt: shift.checkOut };
  assert.equal(workersAtHour([missed], ['1'], '2026-10-25', 0).length, 1);
  assert.equal(workersAtHour([missed], ['1'], '2026-10-25', 1).length, 0);
  assert.equal(workersAtHour([missed], ['1'], '2026-10-26', 0).length, 0);
  assert.equal(
    workersAtHour(
      [{ ...shift, checkIn: '2026-10-25T04:00:00Z' }],
      ['1'],
      '2026-10-25',
      0,
    ).length,
    0,
  );
});

test('rendimiento conserva personas sin ventas, datos sin autor y base de turnos para vendedores', () => {
  const data: GraphicsData = {
    ...empty,
    workers: [
      {
        stationId: '1',
        employeeId: '7',
        role: 'seller',
        name: 'Vendedor',
        opportunityTaken: 10,
        missingTimes: 0,
      },
    ],
    people: [
      {
        ...values,
        taken: null,
        stationId: '1',
        employeeId: '8',
        role: 'seller',
        name: 'Otra persona',
        opportunityTaken: 5,
        missingTimes: 0,
      },
      {
        ...values,
        stationId: '2',
        employeeId: '9',
        role: 'seller',
        name: 'Otro puesto',
      },
      {
        ...values,
        stationId: '1',
        employeeId: null,
        role: 'editor',
        name: 'Sin autor',
      },
      {
        ...values,
        stationId: '1',
        employeeId: null,
        role: 'editor',
        name: 'Sin autor',
      },
    ],
  };
  const sellers = peopleValues(data, ['1'], 'seller');
  assert.equal(sellers.length, 2);
  assert.equal(graphicValue(sellers[0], 'percentage'), 0);
  assert.equal(graphicValue(sellers[1], 'percentage'), 40);
  assert.equal(peopleValues(data, ['1'], 'editor')[0].taken, 20);
});

test('multiple team roles can be compared without merging a person or unknown author across roles', () => {
  const data: GraphicsData = {
    ...empty,
    people: [
      {
        ...values,
        stationId: '1',
        employeeId: '7',
        name: 'Persona',
        role: 'seller',
        opportunityTaken: 10,
      },
      {
        ...values,
        stationId: '1',
        employeeId: '7',
        name: 'Persona',
        role: 'cameraman',
      },
      {
        ...values,
        stationId: '1',
        employeeId: null,
        name: 'Sin autor',
        role: 'editor',
      },
      {
        ...values,
        stationId: '2',
        employeeId: '8',
        name: 'Otro puesto',
        role: 'editor',
      },
    ],
  };
  const combined = peopleValues(data, ['1'], ['seller', 'cameraman', 'editor']);
  assert.equal(combined.length, 3);
  assert.equal(new Set(combined.map((row) => row.id)).size, 3);
  assert.deepEqual(
    new Set(combined.map((row) => row.role)),
    new Set(['seller', 'cameraman', 'editor']),
  );
  assert.equal(peopleValues(data, ['1'], ['cameraman'])[0].taken, 10);
  assert.deepEqual(peopleValues(data, ['1'], []), []);
});
