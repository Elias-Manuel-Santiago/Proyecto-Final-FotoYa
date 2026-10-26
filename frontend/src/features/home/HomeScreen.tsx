/**
 * @file
 * Presenta inicio con accesos y métricas permitidos. Coordina la actualización de datos.
 */
import { Text, View } from 'react-native';
import { Metrics } from '../../components/metrics/Metrics';
import { Screen } from '../../components/ui/Screen';
import { useTheme } from '../../components/ui/theme';
import { businessDate, displayDate } from '../../domain/dates';
import { can } from '../../domain/permissions';
import { reportRows, totalMetrics } from '../../domain/metrics';
import { useWorkspace } from '../../providers/AppProvider';
import { usePeriodData } from '../../hooks/usePeriodData';
import { Feedback } from '../../components/ui/Feedback';
import { ConfirmAction } from '../../components/ui/ConfirmAction';
import { useAction } from '../../hooks/useAction';

// Reúne indicadores y accesos operativos según permisos.
export function HomeScreen() {
  const { styles } = useTheme();
  const { employee, enterCheckIn } = useWorkspace();
  const checkInAction = useAction();
  const today = businessDate();
  const period = { from: today, to: today, stationId: '' };
  const { data, loading, refreshing, error, refreshError, reload } =
    usePeriodData(period);
  const rows = reportRows(data, employee, period);
  return (
    <Screen title="Inicio" refreshing={refreshing} onRefresh={reload}>
      <View style={{ gap: 4 }}>
        <Text style={styles.heading}>Hola, {employee.firstName}</Text>
        <Text style={styles.muted}>{displayDate(today)}</Text>
      </View>
      {employee.roleId === 'manager' && !employee.checkInActive && (
        <ConfirmAction
          title="Activar vista de check-in"
          question="Este dispositivo quedará dedicado a Check-in. Para volver al sistema tendrás que cerrar sesión e ingresar otra vez. Podés usar otro dispositivo para trabajar."
          busy={checkInAction.busy}
          onConfirm={() => checkInAction.run(enterCheckIn)}
        />
      )}
      <Feedback error={checkInAction.error} />
      <Feedback error={error || refreshError} />
      {(loading || refreshing) && (
        <Text accessibilityLiveRegion="polite" style={styles.muted}>
          {loading ? 'Cargando…' : 'Actualizando…'}
        </Text>
      )}
      {!error && !loading && employee.permissions?.includes('counts.read') && (
        <>
          <Metrics
            values={data.summary ?? totalMetrics(rows)}
            showMoney={can(employee, 'sales.read')}
          />
          {rows.some((row) => row.invalidDays > 0) && (
            <Text style={styles.error}>
              Hay días con ventas superiores a las fotos tomadas. Revisá los
              registros.
            </Text>
          )}
          {rows.some((row) => row.taken === null) && (
            <Text style={styles.muted}>
              Hay puestos sin conteo en este período.
            </Text>
          )}
        </>
      )}
    </Screen>
  );
}
