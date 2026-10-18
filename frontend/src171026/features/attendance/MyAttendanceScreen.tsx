import { Button } from '../../components/ui/Button';
import { Text } from 'react-native';
import { PeriodFilters } from '../../components/filters/PeriodFilters';
import { EmptyState, Feedback } from '../../components/ui/Feedback';
import { Screen } from '../../components/ui/Screen';
import { styles } from '../../components/ui/theme';
import { usePeriod } from '../../hooks/usePeriod';
import { usePeriodData } from '../../hooks/usePeriodData';
import { useWorkspace } from '../../providers/AppProvider';
import { AttendanceCard } from './components/AttendanceCard';

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
    <Screen title="Mi asistencia">
      <Text style={styles.muted}>
        Las marcaciones todavía no están habilitadas. Podés consultar los
        registros existentes. Iniciar o cerrar sesión no registra asistencia.
      </Text>
      <PeriodFilters period={period} stations={[]} onChange={update} />
      <Feedback error={error} />
      <Button
        title="Actualizar datos"
        secondary
        busy={loading}
        onPress={reload}
      />
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
