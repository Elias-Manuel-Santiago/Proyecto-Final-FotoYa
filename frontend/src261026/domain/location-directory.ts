import type { Station } from './models';

export const cityKey = (station: Station) => station.cityId ?? station.city;
export const eventKey = (station: Station) => station.eventId ?? station.event;

export function locationDirectory(
  stations: Station[],
  kind: 'city' | 'event',
  city = '',
) {
  const groups = new Map<
    string,
    {
      id: string;
      name: string;
      city: string;
      cityName: string;
      stations: Station[];
    }
  >();
  for (const station of stations) {
    if (!station[kind] || (city && cityKey(station) !== city)) continue;
    const id = kind === 'city' ? cityKey(station) : eventKey(station);
    const key = JSON.stringify(kind === 'city' ? [id] : [cityKey(station), id]);
    const group = groups.get(key) ?? {
      id,
      name: station[kind],
      city: cityKey(station),
      cityName: station.city,
      stations: [],
    };
    group.stations.push(station);
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => a.name.localeCompare(b.name));
}
