import assert from 'node:assert/strict';
import { test } from 'node:test';
import { locationDirectory } from '../src/domain/location-directory';
import { periodScopePatch } from '../src/domain/filter-scopes';
import type { Station } from '../src/domain/models';

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
    cityId: '10',
    event: 'Feria',
    eventId: '20',
    active: false,
  },
  {
    id: '3',
    name: 'Tres',
    city: 'Centro',
    cityId: '11',
    event: 'Feria',
    eventId: '21',
  },
  {
    id: '4',
    name: 'Cuatro',
    city: 'Centro',
    cityId: '10',
    event: '',
  },
];

test('ciudades y eventos agrupan por ID sin mezclar nombres iguales ni excluir puestos inactivos', () => {
  const cities = locationDirectory(stations, 'city');
  assert.equal(cities.length, 2);
  assert.equal(cities.find((city) => city.id === '10')?.stations.length, 3);
  const events = locationDirectory(stations, 'event', '10');
  assert.equal(events.length, 1);
  assert.deepEqual(
    events[0].stations.map((s) => s.id),
    ['1', '2'],
  );
  assert.equal(locationDirectory(stations, 'event', 'unknown').length, 0);
  assert.deepEqual(
    periodScopePatch(stations, [
      `city:${events[0].city}`,
      `event:${events[0].id}`,
    ]).stationIds,
    ['1', '2'],
  );
});

test('los catálogos sin IDs mantienen navegación por nombre', () => {
  const legacy = [{ ...stations[0], cityId: undefined, eventId: undefined }];
  const [event] = locationDirectory(legacy, 'event', 'Centro');
  assert.equal(event.id, 'Feria');
  assert.deepEqual(
    periodScopePatch(legacy, [`city:${event.city}`, `event:${event.id}`])
      .stationIds,
    ['1'],
  );
});
