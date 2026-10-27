/**
 * @file
 * Simula gestión de puestos y catálogos. Comprueba disponibilidad y alcance sin modificar una
 * base real.
 */
import type {
  AppData,
  Employee,
  StationInput,
} from '../../../src/domain/models';
import { operationId } from '../../../src/domain/format';
import { requirePermission } from '../../../src/domain/permissions';

function authorize(actor: Employee) {
  requirePermission(actor, 'stations.manage');
  if (actor.roleId !== 'owner')
    throw new Error('Solo el administrador puede gestionar puestos.');
}

export function createStation(
  data: AppData,
  actor: Employee,
  input: StationInput,
) {
  authorize(actor);
  const event = data.events?.find((row) => row.id === input.eventId);
  if (!event) throw new Error('El evento no existe.');
  const city = data.cities?.find((row) => row.id === event.cityId);
  if (!city) throw new Error('La ciudad no existe.');
  const fields = {
    name: event.name,
    city: city.name,
    event: event.name,
    cityId: city.id,
    eventId: event.id,
  };
  if (
    data.stations.some((row) =>
      (['name', 'city', 'event'] as const).every(
        (key) => row[key].toLowerCase() === fields[key].toLowerCase(),
      ),
    )
  )
    throw new Error('El puesto ya existe. Si está inactivo, reactivalo.');
  data.stations.push({ ...fields, id: operationId('station'), active: true });
}

export function setStationActive(
  data: AppData,
  actor: Employee,
  stationId: string,
  active: boolean,
) {
  authorize(actor);
  const station = data.stations.find((row) => row.id === stationId);
  if (!station) throw new Error('El puesto no existe.');
  station.active = active;
}
