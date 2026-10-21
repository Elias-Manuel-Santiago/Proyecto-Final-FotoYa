/**
 * @file
 * Consulta asistencia administrativa por período y alcance. Delega presentación del horario a
 * AttendanceCard.
 */
import { Text } from 'react-native';
import { styles } from '../../components/ui/theme';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { PeriodFilters } from '../../components/filters/PeriodFilters';
import { EmptyState, Feedback } from '../../components/ui/Feedback';
import { Screen } from '../../components/ui/Screen';
import { Select } from '../../components/ui/Select';
import { fullName } from '../../domain/format';
import { matchesPeriod, visibleStations } from '../../domain/metrics';
import { hasStationAccess } from '../../domain/permissions';
import { usePeriodData } from '../../hooks/usePeriodData';
import { usePeriod } from '../../hooks/usePeriod';
import { useWorkspace } from '../../providers/AppProvider';
import { AttendanceCard } from './components/AttendanceCard';

// Combina filtros y datos del período para consultar asistencia de empleados visibles.
export function AttendanceScreen() {
  const { employeeId: initialId } = useLocalSearchParams<{
    employeeId?: string;
  }>();
  const { employee } = useWorkspace();
  const { period, update, error: periodError } = usePeriod();
  const { data, loading, reload, error: queryError } = usePeriodData(period);
  const error = periodError || queryError;
  const [employeeId, setEmployeeId] = useState(initialId ?? '');
  const employees = data.employees.filter((row) => row.roleId !== 'client');
  const records = error
    ? []
    : data.attendance
        .filter(
          (row) =>
            hasStationAccess(employee, row.stationId) &&
            matchesPeriod(row, period) &&
            (!employeeId || row.employeeId === employeeId),
        )
        .sort((a, b) => b.checkIn.localeCompare(a.checkIn));
  return (
    <Screen
      title="Horarios de empleados"
      refreshing={loading}
      onRefresh={reload}
    >
      <PeriodFilters
        period={period}
        stations={visibleStations(data, employee)}
        onChange={update}
      />
      <Select
        label="Empleado"
        value={employeeId}
        onChange={setEmployeeId}
        options={[
          { value: '', label: 'Todos' },
          ...employees.map((row) => ({ value: row.id, label: fullName(row) })),
        ]}
      />
      <Feedback error={error} />
      {loading && <Text style={styles.muted}>Consultando servidor…</Text>}
      {!error && !loading && !records.length && <EmptyState />}
      {records.map((record) => {
        const person = data.employees.find(
          (row) => row.id === record.employeeId,
        );
        return (
          <AttendanceCard
            key={record.id}
            record={record}
            employeeName={person ? fullName(person) : 'Empleado no disponible'}
            stationName={
              data.stations.find((row) => row.id === record.stationId)?.name ??
              ''
            }
          />
        );
      })}
    </Screen>
  );
}
