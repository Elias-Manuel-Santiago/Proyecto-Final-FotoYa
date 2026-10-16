import { businessDate } from '../../../src/domain/dates';
import type { AppData, Employee } from '../../../src/domain/models';
import { requirePermission } from '../../../src/domain/permissions';

export function checkIn(data: AppData, actor: Employee, id: string, now: Date) {
  requirePermission(actor, 'attendance.self');
  const existing = data.attendance.find((row) => row.id === id);
  if (existing) {
    if (existing.employeeId !== actor.id)
      throw new Error('La operación ya fue utilizada.');
    return;
  }
  if (
    data.attendance.some((row) => row.employeeId === actor.id && !row.checkOut)
  )
    throw new Error('Ya tenés un turno abierto.');
  data.attendance.push({
    id,
    employeeId: actor.id,
    stationId: actor.stationId,
    date: businessDate(now),
    checkIn: now.toISOString(),
    checkOut: null,
  });
}

export function checkOut(
  data: AppData,
  actor: Employee,
  id: string,
  now: Date,
) {
  requirePermission(actor, 'attendance.self');
  const record = data.attendance.find(
    (row) => row.id === id && row.employeeId === actor.id,
  );
  if (!record) throw new Error('El turno no existe.');
  if (record.checkOut) return;
  if (now.getTime() < Date.parse(record.checkIn))
    throw new Error('La salida no puede ser anterior a la entrada.');
  record.checkOut = now.toISOString();
}
