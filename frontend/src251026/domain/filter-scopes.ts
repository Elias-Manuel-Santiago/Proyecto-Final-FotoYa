import type { GraphicScope } from './graphics';
import type { Period, Station } from './models';

export function scopeColumns(scopes: GraphicScope[]) {
  return (
    [
      ['city', 'Ciudades'],
      ['event', 'Eventos'],
      ['station', 'Puestos'],
    ] as const
  ).map(([kind, title]) => ({
    title,
    options: scopes
      .filter((scope) => scope.id.startsWith(`${kind}:`))
      .map((scope) => ({
        value: scope.id,
        label: scope.label.replace(/^(Ciudad|Evento|Puesto) · /, ''),
      })),
  }));
}

export function periodScopeIds(period: Period) {
  return (
    period.scopeIds ?? [
      ...(period.city ? [`city:${period.city}`] : []),
      ...(period.event ? [`event:${period.event}`] : []),
      ...(period.stationId ? [`station:${period.stationId}`] : []),
    ]
  );
}

// Dentro de una columna las opciones se suman; entre columnas se intersectan.
// Una selección incompatible debe producir cero puestos, nunca volver a "todos".
export function periodScopePatch(
  stations: Station[],
  scopeIds: string[],
): Partial<Period> {
  const ids = (kind: string) =>
    scopeIds
      .filter((id) => id.startsWith(`${kind}:`))
      .map((id) => id.slice(kind.length + 1));
  const cities = ids('city');
  const events = ids('event');
  const selectedStations = ids('station');
  return {
    city: '',
    event: '',
    stationId: '',
    scopeIds,
    stationIds: scopeIds.length
      ? stations
          .filter(
            (station) =>
              (!cities.length ||
                cities.includes(station.cityId ?? station.city)) &&
              (!events.length ||
                events.includes(station.eventId ?? station.event)) &&
              (!selectedStations.length ||
                selectedStations.includes(station.id)),
          )
          .map((station) => station.id)
      : undefined,
  };
}
