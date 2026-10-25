import { DataTable } from '../../../components/ui/DataTable';
import { displayDate, displayInstant, duration } from '../../../domain/dates';
import type { AppData, Attendance } from '../../../domain/models';
import { fullName } from '../../../domain/format';
export function AttendanceTable({
  records,
  data,
  personal = false,
}: {
  records: Attendance[];
  data: AppData;
  personal?: boolean;
}) {
  return (
    <DataTable
      label={personal ? 'Mi asistencia' : 'Horarios y asistencias'}
      columns={[
        ...(personal ? [] : ['Empleado']),
        'Puesto',
        'Fecha',
        'Entrada',
        'Salida',
        'Duración',
      ]}
      rows={records.map((record) => {
        const employee = data.employees.find((p) => p.id === record.employeeId);
        return {
          key: record.id,
          cells: [
            ...(personal
              ? []
              : [employee ? fullName(employee) : 'Empleado no disponible']),
            data.stations.find((s) => s.id === record.stationId)?.name ??
              `Puesto ${record.stationId}`,
            displayDate(record.date),
            displayInstant(record.checkIn),
            record.checkOut
              ? displayInstant(record.checkOut)
              : record.closedAt
                ? 'No hizo check-out'
                : 'Sin registrar',
            duration(record.checkIn, record.checkOut, record.closedAt),
          ],
        };
      })}
    />
  );
}
