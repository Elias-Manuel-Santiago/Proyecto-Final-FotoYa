/**
 * @file
 * Consulta historial propio con attendance/mine. Conserva jornadas de puestos anteriores y
 * permite cambiar período.
 */
import { Text } from 'react-native';
import { PeriodFilters } from '../../components/filters/PeriodFilters';
import { EmptyState, Feedback } from '../../components/ui/Feedback';
import { Screen } from '../../components/ui/Screen';
import { styles } from '../../components/ui/theme';
import { usePeriod } from '../../hooks/usePeriod';
import { usePeriodData } from '../../hooks/usePeriodData';
import { useWorkspace } from '../../providers/AppProvider';
import { AttendanceCard } from './components/AttendanceCard';

// Consulta asistencia propia por período con la variante personal del repositorio.
export function MyAttendanceScreen() {
  const { employee } = useWorkspace();
  const { period, update, error: periodError } = usePeriod();
  const {
    data,
    loading,
    reload,
    error: queryError,
  } = usePeriodData(period, true);
  const records = data.attendance.filter(
    (row) => row.employeeId === employee.id,
  );
  const error = periodError || queryError;
  return (
    <Screen title="Mi asistencia" refreshing={loading} onRefresh={reload}>
      <Text style={styles.muted}>
        Registrá tu entrada y salida en la vista de check-in del encargado con
        tu mail y contraseña. Iniciar o cerrar sesión no registra asistencia.
      </Text>
      <PeriodFilters period={period} stations={[]} onChange={update} />
      <Feedback error={error} />
      {loading && <Text style={styles.muted}>Consultando servidor…</Text>}
      {!loading && !error && !records.length && (
        <EmptyState message="No hay horarios en este período." />
      )}
      {records.map((record) => (
        <AttendanceCard
          key={record.id}
          record={record}
          stationName={
            data.stations.find((row) => row.id === record.stationId)?.name ??
            `Puesto ${record.stationId}`
          }
        />
      ))}
    </Screen>
  );
}
