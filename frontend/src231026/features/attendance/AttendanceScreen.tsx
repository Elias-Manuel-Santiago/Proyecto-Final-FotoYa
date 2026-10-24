import { SortControl } from '../../components/filters/SortControl';
/**
 * @file
 * Consulta asistencia administrativa por período y alcance. Delega presentación del horario a
 * AttendanceCard.
 */
import { Text } from 'react-native';
import { useTheme } from '../../components/ui/theme';
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
import { AttendanceTable } from './components/AttendanceTable';

// Combina filtros y datos del período para consultar asistencia de empleados visibles.
export function AttendanceScreen() {
  const [ascending, setAscending] = useState(false);
  const { styles } = useTheme();
  const { employeeId: initialId } = useLocalSearchParams<{
    employeeId?: string;
  }>();
  const { employee } = useWorkspace();
  const { period, update, error: periodError } = usePeriod();
  const {
    data,
    loading,
    refreshing,
    reload,
    refreshError,
    error: queryError,
  } = usePeriodData(period);
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
        .sort(
          (a, b) => (ascending ? 1 : -1) * a.checkIn.localeCompare(b.checkIn),
        );
  return (
    <Screen
      title="Horarios de empleados"
      refreshing={refreshing}
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
      <SortControl ascending={ascending} onChange={setAscending} />
      <Feedback error={error || refreshError} />
      <Text style={styles.muted}>
        {loading ? 'Cargando…' : refreshing ? 'Actualizando…' : ' '}
      </Text>
      {!error && !loading && !records.length && <EmptyState />}
      {!error && !loading && <AttendanceTable records={records} data={data} />}
    </Screen>
  );
}
