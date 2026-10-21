/**
 * @file
 * Filtra puestos/períodos y adapta indicadores. Prioriza informes remotos y conserva valores
 * desconocidos ante días faltantes o inconsistentes.
 */
import type { AppData, Employee, Period, Station } from './models';
import { hasStationAccess } from './permissions';
import { sumAmounts } from './amounts';

// Filtra puestos visibles según el alcance del usuario.
export function visibleStations(data: AppData, employee: Employee) {
  return data.stations.filter((station) =>
    hasStationAccess(employee, station.id),
  );
}

// Comprueba fecha y puesto contra el filtro seleccionado.
export function matchesPeriod(
  row: { stationId: string; date: string },
  period: Period,
) {
  return (
    row.date >= period.from &&
    row.date <= period.to &&
    (!period.stationId || row.stationId === period.stationId)
  );
}

// Prioriza el informe remoto; si falta, calcula indicadores preservando datos desconocidos.
export function stationMetrics(
  data: AppData,
  station: Station,
  period: Period,
) {
  const remote = data.reports?.find((row) => row.station.id === station.id);
  if (remote) return remote;
  const counts = data.counts.filter(
    (row) => row.stationId === station.id && matchesPeriod(row, period),
  );
  const sales = data.sales.filter(
    (row) => row.stationId === station.id && matchesPeriod(row, period),
  );
  const expectedDays =
    Math.round(
      (Date.parse(`${period.to}T12:00:00Z`) -
        Date.parse(`${period.from}T12:00:00Z`)) /
        86400000,
    ) + 1;
  const registeredDays = new Set(counts.map((row) => row.date)).size;
  const taken =
    registeredDays > 0 && registeredDays === expectedDays
      ? counts.reduce((sum, row) => sum + row.taken, 0)
      : null;
  const sold = counts.some((row) => row.sold !== undefined)
    ? counts.reduce((sum, row) => sum + (row.sold ?? 0), 0)
    : sales.reduce((sum, row) => sum + row.quantity, 0);
  const invalidDays = counts.filter(
    (row) => row.sold !== undefined && row.sold > row.taken,
  ).length;
  const earnings = counts.some((row) => row.revenue !== undefined)
    ? sumAmounts(counts.map((row) => row.revenue ?? 0))
    : sumAmounts(sales.map((row) => row.total));
  return {
    station,
    invalidDays,
    registeredDays,
    expectedDays,
    taken,
    sold,
    earnings,
    discarded: taken === null || invalidDays ? null : taken - sold,
    percentage: taken && !invalidDays ? (sold / taken) * 100 : null,
  };
}

// Aplica alcance y filtros de puesto, ciudad y evento antes de construir filas.
export function reportRows(data: AppData, employee: Employee, period: Period) {
  return visibleStations(data, employee)
    .filter(
      (station) =>
        (!period.stationId || period.stationId === station.id) &&
        (!period.city || period.city === (station.cityId ?? station.city)) &&
        (!period.event || period.event === (station.eventId ?? station.event)),
    )
    .map((station) => stationMetrics(data, station, period));
}

// Suma indicadores sin presentar conteos incompletos o inconsistentes como conocidos.
export function totalMetrics(rows: ReturnType<typeof reportRows>) {
  const known = rows.filter((row) => row.taken !== null);
  const taken = known.reduce((sum, row) => sum + (row.taken ?? 0), 0);
  const sold = rows.reduce((sum, row) => sum + row.sold, 0);
  const earnings = sumAmounts(rows.map((row) => row.earnings));
  const complete = rows.length > 0 && known.length === rows.length;
  const consistent = rows.every((row) => row.discarded !== null);
  return {
    taken: complete ? taken : null,
    sold,
    earnings,
    discarded: complete && consistent ? taken - sold : null,
    percentage:
      complete && consistent && taken > 0 ? (sold / taken) * 100 : null,
  };
}
