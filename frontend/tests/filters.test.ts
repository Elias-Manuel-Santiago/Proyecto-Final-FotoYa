import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dateFromCalendar, dateToCalendar } from '../src/domain/filter-dates';
import {
  periodScopeIds,
  periodScopePatch,
  scopeColumns,
} from '../src/domain/filter-scopes';
import { graphicScopes } from '../src/domain/graphics';
import { matchesPeriod, reportRows } from '../src/domain/metrics';
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
