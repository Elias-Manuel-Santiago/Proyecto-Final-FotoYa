import { useWorkspace } from '../../../providers/AppProvider';
import { can } from '../../../domain/permissions';
import { hoursLabel } from '../../../domain/attendance-payroll';
import { AttendanceDuration } from './AttendanceDuration';
import { DataTable } from '../../../components/ui/DataTable';
import { displayDate, displayInstant, duration } from '../../../domain/dates';
import type { AppData, Attendance } from '../../../domain/models';
import { fullName } from '../../../domain/format';
export function AttendanceTable({
  records,
  data,
  personal = false,
  onDurationSaved,
}: {
  records: Attendance[];
  data: AppData;
  personal?: boolean;
  onDurationSaved?: () => void;
}) {
  const { employee: actor, refresh } = useWorkspace();
  const editable =
    !personal && actor.roleId === 'secretary' && can(actor, 'attendance.read');
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
            editable && !record.checkOut ? (
              <AttendanceDuration
                record={record}
                onSaved={
                  onDurationSaved ??
                  (() => {
                    void refresh();
                  })
                }
              />
            ) : !record.checkOut && record.manualMinutes != null ? (
              `${hoursLabel(record.manualMinutes * 60)} · Informada`
            ) : (
              duration(record.checkIn, record.checkOut, record.closedAt)
            ),
          ],
        };
      })}
    />
  );
}
