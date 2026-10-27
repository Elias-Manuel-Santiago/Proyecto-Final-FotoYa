import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dateFromCalendar, dateToCalendar } from '../src/domain/filter-dates';
import { periodError } from '../src/domain/dates';
import {
  periodScopeIds,
  periodScopePatch,
  scopeColumns,
} from '../src/domain/filter-scopes';
import { graphicScopes } from '../src/domain/graphics';
import {
  matchesPeriod,
  reportRows,
  stationMetrics,
} from '../src/domain/metrics';
import type { Station, Period, AppData, Employee } from '../src/domain/models';

const stations: Station[] = [
  {
    id: '1',
    name: 'Uno',
    city: 'Centro',
    cityId: '10',
    event: 'Feria',
    eventId: '20',
  },
  {
    id: '2',
    name: 'Dos',
    city: 'Centro',
    cityId: '11',
    event: 'Feria',
    eventId: '21',
  },
  {
    id: '3',
    name: 'Tres',
    city: 'Centro',
    cityId: '10',
    event: 'Feria',
    eventId: '21',
  },
];
const period: Period = { from: '2026-10-01', to: '2026-10-25', stationId: '' };

test('Siempre incluye fotos de cualquier fecha y conserva el alcance por puesto', () => {
  const allTime = { ...period, allTime: true, stationId: '1' };
  for (const date of ['2020-01-01', '2026-10-15', '2030-01-01']) {
    assert.equal(matchesPeriod({ stationId: '1', date }, allTime), true);
    assert.equal(matchesPeriod({ stationId: '2', date }, allTime), false);
  }
  assert.equal(
    matchesPeriod(
      { stationId: '1', date: '2020-01-01' },
      { ...allTime, stationIds: [] },
    ),
    false,
  );
  assert.equal(periodError('', '', true), '');
  assert.notEqual(periodError('', '', false), '');
});

test('Siempre suma los días registrados de distintos años sin inventar cobertura de un rango', () => {
  const data = {
    stations,
    sales: [],
    counts: [
      {
        stationId: '1',
        date: '2020-01-01',
        taken: 100,
        sold: 60,
        revenue: 300,
      },
      { stationId: '1', date: '2026-10-25', taken: 50, sold: 20, revenue: 200 },
      {
        stationId: '2',
        date: '2020-01-01',
        taken: 900,
        sold: 800,
        revenue: 900,
      },
    ],
  } as unknown as AppData;
  const allTime = { ...period, allTime: true };
  const result = stationMetrics(data, stations[0], allTime);
  assert.equal(result.taken, 150);
  assert.equal(result.sold, 80);
  assert.equal(result.earnings, 500);
  assert.equal(result.discarded, 70);
  assert.equal(result.expectedDays, 2);
  assert.equal(stationMetrics(data, stations[2], allTime).taken, null);
  data.counts[0].sold = 101;
  assert.equal(stationMetrics(data, stations[0], allTime).discarded, null);
});

test('las tres columnas distinguen IDs aunque ciudades y eventos compartan nombre', () => {
  const columns = scopeColumns(graphicScopes(stations));
  assert.deepEqual(
    columns.map((column) => column.title),
    ['Ciudades', 'Eventos', 'Puestos'],
  );
  assert.deepEqual(
    columns[0].options.map((option) => option.value),
    ['city:10', 'city:11'],
  );
  assert.equal(columns[2].options.length, 3);
});

test('selección múltiple suma opciones dentro de una columna e intersecta columnas', () => {
  assert.deepEqual(
    periodScopePatch(stations, ['city:10', 'city:11']).stationIds,
    ['1', '2', '3'],
  );
  const patch = periodScopePatch(stations, ['city:10', 'event:21']);
  assert.deepEqual(patch.stationIds, ['3']);
  assert.deepEqual(periodScopeIds({ ...period, ...patch }), [
    'city:10',
    'event:21',
  ]);
  assert.deepEqual(
    periodScopePatch(stations, ['city:10', 'station:2']).stationIds,
    [],
  );
  assert.equal(periodScopePatch(stations, []).stationIds, undefined);
});

test('los listados y los indicadores respetan el mismo alcance y no amplían una selección vacía', () => {
  const selected = {
    ...period,
    ...periodScopePatch(stations, ['station:1', 'station:3']),
  };
  assert.equal(
    matchesPeriod({ stationId: '2', date: period.from }, selected),
    false,
  );
  assert.equal(
    matchesPeriod({ stationId: '3', date: period.from }, selected),
    true,
  );
  assert.equal(
    matchesPeriod({ stationId: '3', date: '2026-09-30' }, selected),
    false,
  );
  assert.equal(
    matchesPeriod(
      { stationId: '3', date: period.from },
      { ...period, stationIds: [] },
    ),
    false,
  );
  const data = { stations, counts: [], sales: [] } as unknown as AppData;
  const employee = { roleId: 'owner', active: true } as Employee;
  assert.deepEqual(
    reportRows(data, employee, selected).map((row) => row.station.id),
    ['1', '3'],
  );
  assert.deepEqual(
    reportRows(data, employee, { ...period, stationIds: [] }),
    [],
  );
  assert.deepEqual(
    reportRows(
      data,
      { roleId: 'manager', active: true, stationId: '1' } as Employee,
      selected,
    ).map((row) => row.station.id),
    ['1'],
  );
});

test('el calendario conserva el día local en distintas zonas horarias, cambios de año y días bisiestos', () => {
  const originalZone = process.env.TZ;
  try {
    for (const zone of [
      'America/Argentina/Buenos_Aires',
      'Pacific/Kiritimati',
      'America/Los_Angeles',
    ]) {
      process.env.TZ = zone;
      for (const value of [
        '2026-01-01',
        '2026-12-31',
        '2024-02-29',
        '0099-01-01',
      ]) {
        const date = dateToCalendar(value);
        assert.equal(date.getHours(), 12);
        assert.equal(dateFromCalendar(date), value);
      }
    }
  } finally {
    if (originalZone === undefined) delete process.env.TZ;
    else process.env.TZ = originalZone;
  }
});
