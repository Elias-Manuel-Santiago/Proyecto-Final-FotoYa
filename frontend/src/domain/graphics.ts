import type { Station } from './models';
import { sumAmounts } from './amounts';

export type GraphicMetric =
  'earnings' | 'sales' | 'average' | 'taken' | 'percentage';
export const graphicMetrics: { value: GraphicMetric; label: string }[] = [
  { value: 'earnings', label: 'Ingresos' },
  { value: 'sales', label: 'Cantidad de ventas' },
  { value: 'average', label: 'Precio promedio por venta' },
  { value: 'taken', label: 'Familias fotografiadas' },
  { value: 'percentage', label: 'Porcentaje de familias que compraron' },
];
export interface GraphicValues {
  earnings: number;
  sales: number;
  sold: number;
  taken: number | null;
  invalidConversion?: boolean;
}
export interface GraphicDay extends GraphicValues {
  date: string;
  stationId: string;
}
export interface GraphicHour extends GraphicValues {
  hour: number | null;
  stationId: string;
}
export interface GraphicPerson extends GraphicValues {
  stationId: string;
  employeeId: string | null;
  name: string;
  role: 'seller' | 'cameraman' | 'editor';
  opportunityTaken?: number;
  missingTimes?: number;
}
export interface GraphicAttendance {
  id: string;
  employeeId: string;
  stationId: string;
  name: string;
  role: string;
  checkIn: string;
  checkOut: string | null;
  closedAt: string | null;
}
export interface GraphicsData {
  days: GraphicDay[];
  hours: GraphicHour[];
  people: GraphicPerson[];
  workers: (Pick<
    GraphicPerson,
    'stationId' | 'employeeId' | 'name' | 'role'
  > & { opportunityTaken?: number; missingTimes?: number })[];
  attendance: GraphicAttendance[];
}
export interface GraphicScope {
  id: string;
  label: string;
  stationIds: string[];
}

// Cada selección es una serie independiente: elegir una ciudad y su puesto nunca duplica el total.
export function graphicScopes(
  stations: Station[],
  ownStationOnly = false,
): GraphicScope[] {
  if (ownStationOnly)
    return stations.map((s) => ({
      id: `station:${s.id}`,
      label: s.name,
      stationIds: [s.id],
    }));
  const scopes: GraphicScope[] = [
    { id: 'total', label: 'Total', stationIds: stations.map((s) => s.id) },
  ];
  for (const kind of ['city', 'event'] as const) {
    const keys = new Map(
      stations
        .filter((s) => s[kind])
        .map((s) => [s[`${kind}Id`] ?? s[kind], s[kind]]),
    );
    for (const [key, name] of keys)
      scopes.push({
        id: `${kind}:${key}`,
        label: `${kind === 'city' ? 'Ciudad' : 'Evento'} · ${name}`,
        stationIds: stations
          .filter((s) => (s[`${kind}Id`] ?? s[kind]) === key)
          .map((s) => s.id),
      });
  }
  return [
    ...scopes,
    ...stations.map((s) => ({
      id: `station:${s.id}`,
      label: `Puesto · ${s.name}`,
      stationIds: [s.id],
    })),
  ];
}

export function sumGraphicValues(
  rows: GraphicValues[],
  complete = true,
): GraphicValues {
  return {
    earnings: sumAmounts(rows.map((r) => r.earnings)),
    sales: rows.reduce((sum, r) => sum + r.sales, 0),
    sold: rows.reduce((sum, r) => sum + r.sold, 0),
    taken:
      complete && rows.every((r) => r.taken !== null)
        ? rows.reduce((sum, r) => sum + (r.taken ?? 0), 0)
        : null,
    invalidConversion: rows.some(
      (r) => r.invalidConversion || (r.taken !== null && r.sold > r.taken),
    ),
  };
}

export function graphicValue(
  values: GraphicValues,
  metric: GraphicMetric,
): number | null {
  if (metric === 'average')
    return values.sales > 0 ? values.earnings / values.sales : null;
  if (metric === 'percentage')
    return !values.invalidConversion &&
      values.taken !== null &&
      values.taken > 0 &&
      values.sold <= values.taken
      ? (values.sold / values.taken) * 100
      : null;
  return values[metric];
}

export function periodDates(from: string, to: string) {
  const dates: string[] = [];
  for (
    let time = Date.parse(`${from}T12:00:00Z`);
    time <= Date.parse(`${to}T12:00:00Z`) && dates.length < 367;
    time += 86400000
  )
    dates.push(new Date(time).toISOString().slice(0, 10));
  return dates;
}

export function dailyValues(
  data: GraphicsData,
  scope: GraphicScope,
  date: string,
) {
  const rows = data.days.filter(
    (r) => r.date === date && scope.stationIds.includes(r.stationId),
  );
  return sumGraphicValues(
    rows,
    scope.stationIds.length > 0 &&
      new Set(rows.map((r) => r.stationId)).size === scope.stationIds.length,
  );
}

export function hourlyValues(
  data: GraphicsData,
  scope: GraphicScope,
  day: string,
  hour: number | null,
) {
  const rows = data.hours.filter(
    (r) => r.hour === hour && scope.stationIds.includes(r.stationId),
  );
  const known = dailyValues(data, scope, day).taken !== null;
  const missing = data.hours.some(
    (r) =>
      r.hour === null &&
      scope.stationIds.includes(r.stationId) &&
      (r.taken ?? 0) > 0,
  );
  return sumGraphicValues(rows, known && (hour === null || !missing));
}

export function peopleValues(
  data: GraphicsData,
  stationIds: string[],
  roles: GraphicPerson['role'] | GraphicPerson['role'][],
) {
  const selectedRoles = Array.isArray(roles) ? roles : [roles];
  const people = new Map<string, GraphicPerson>();
  for (const row of [...data.workers, ...data.people]) {
    if (
      !selectedRoles.includes(row.role) ||
      !stationIds.includes(row.stationId)
    )
      continue;
    const key = `${row.role}:${row.stationId}:${row.employeeId ?? 'unknown'}`;
    if (!people.has(key))
      people.set(key, {
        ...row,
        earnings: 0,
        sales: 0,
        sold: 0,
        taken: row.role === 'seller' ? null : 0,
      });
    if ('sales' in row) {
      const previous = people.get(key)!;
      const values = sumGraphicValues(
        [previous, row as GraphicPerson],
        row.role !== 'seller',
      );
      people.set(key, { ...previous, ...row, ...values });
    }
  }
  // El denominador del vendedor proviene de fotos tomadas durante sus turnos, sin atribuirle autoría.
  return [...people.entries()].map(([id, row]) => ({
    id,
    ...row,
    taken:
      row.role === 'seller'
        ? row.employeeId !== null && !row.missingTimes
          ? (row.opportunityTaken ?? null)
          : null
        : row.taken,
  }));
}

export function workersAtHour(
  rows: GraphicAttendance[],
  stationIds: string[],
  day: string,
  hour: number,
) {
  const start = Date.parse(
    `${day}T${String(hour).padStart(2, '0')}:00:00-03:00`,
  );
  const end = start + 3600000;
  return rows.filter((r) => {
    const attendanceEnd = r.checkOut ?? r.closedAt;
    return (
      stationIds.includes(r.stationId) &&
      Date.parse(r.checkIn) < end &&
      (!attendanceEnd || Date.parse(attendanceEnd) > start)
    );
  });
}
