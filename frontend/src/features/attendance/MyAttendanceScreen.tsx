import { useState } from 'react';
import { SortControl } from '../../components/filters/SortControl';
/**
 * @file
 * Consulta historial propio con attendance/mine. Conserva jornadas de puestos anteriores y
 * permite cambiar período.
 */
import { Text } from 'react-native';
import { PeriodFilters } from '../../components/filters/PeriodFilters';
import { EmptyState, Feedback } from '../../components/ui/Feedback';
import { Screen } from '../../components/ui/Screen';
import { useTheme } from '../../components/ui/theme';
import { usePeriod } from '../../hooks/usePeriod';
import { usePeriodData } from '../../hooks/usePeriodData';
import { useWorkspace } from '../../providers/AppProvider';
import { AttendanceTable } from './components/AttendanceTable';

// Consulta asistencia propia por período con la variante personal del repositorio.
export function MyAttendanceScreen() {
  const [ascending, setAscending] = useState(false);
  const { styles } = useTheme();
  const { employee } = useWorkspace();
  const { period, update, error: periodError } = usePeriod();
  const {
    data,
    loading,
    refreshing,
    refreshError,
    reload,
    error: queryError,
  } = usePeriodData(period, true);
  const records = data.attendance
    .filter((row) => row.employeeId === employee.id)
    .sort((a, b) => (ascending ? 1 : -1) * a.checkIn.localeCompare(b.checkIn));
  const error = periodError || queryError;
  return (
    <Screen title="Mi asistencia" refreshing={refreshing} onRefresh={reload}>
      <Text style={styles.muted}>
        Registrá tu entrada y salida en la vista de Check-in del encargado con
        tu mail y contraseña. Iniciar o cerrar sesión no registra asistencia.
      </Text>
      <PeriodFilters period={period} stations={[]} onChange={update}>
        <SortControl ascending={ascending} onChange={setAscending} />
      </PeriodFilters>
      <Feedback error={error || refreshError} />
      {(loading || refreshing) && (
        <Text accessibilityLiveRegion="polite" style={styles.muted}>
          {loading ? 'Cargando…' : 'Actualizando…'}
        </Text>
      )}
      {!loading && !error && !records.length && (
        <EmptyState message="No hay horarios en este período." />
      )}
      {!error && !loading && (
        <AttendanceTable records={records} data={data} personal />
      )}
    </Screen>
  );
}
