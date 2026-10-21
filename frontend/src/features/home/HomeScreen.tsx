/**
 * @file
 * Presenta inicio con accesos y métricas permitidos. Coordina actualización de datos y entrada
 * del encargado al check-in.
 */
import { Button } from '../../components/ui/Button';
import { Link } from 'expo-router';
import { Text } from 'react-native';
import { Metrics } from '../../components/metrics/Metrics';
import { Screen } from '../../components/ui/Screen';
import { styles } from '../../components/ui/theme';
import { businessDate, displayDate } from '../../domain/dates';
import { can, roleLabels } from '../../domain/permissions';
import { reportRows, totalMetrics } from '../../domain/metrics';
import { useWorkspace } from '../../providers/AppProvider';
import { usePeriodData } from '../../hooks/usePeriodData';
import { Feedback } from '../../components/ui/Feedback';
import { useAction } from '../../hooks/useAction';

// Reúne indicadores y accesos operativos, incluida la entrada al kiosco.
export function HomeScreen() {
  const { employee, enterCheckIn } = useWorkspace();
  const action = useAction();
  const today = businessDate();
  const period = { from: today, to: today, stationId: '' };
  const { data, loading, refreshing, error, refreshError, reload } =
    usePeriodData(period);
  const rows = reportRows(data, employee, period);
  return (
    <Screen
      title={roleLabels[employee.roleId]}
      refreshing={refreshing}
      onRefresh={reload}
    >
      {employee.roleId === 'manager' && (
        <>
          <Button
            title="Activar vista de check-in"
            busy={action.busy}
            onPress={() => {
              void action.run(enterCheckIn);
            }}
          />
          <Feedback error={action.error} />
        </>
      )}
      <Text style={styles.heading}>{displayDate(today)}</Text>
      <Feedback error={error || refreshError} />
      <Text style={styles.muted}>
        {loading ? 'Consultando servidor…' : refreshing ? 'Actualizando…' : ' '}
      </Text>
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
      {can(employee, 'photos.read') && (
        <Link href="/photos" style={styles.card}>
          {employee.roleId === 'client' ? 'Ver mis fotos' : 'Consultar fotos'}
        </Link>
      )}
      {can(employee, 'attendance.self') && (
        <Link href="/my-attendance" style={styles.card}>
          Consultar mi asistencia
        </Link>
      )}
      {can(employee, 'sales.read') && (
        <Link href="/sales" style={styles.card}>
          Consultar ventas
        </Link>
      )}
      {can(employee, 'employees.manage') && (
        <Link href="/employees/new" style={styles.card}>
          Alta de usuario
        </Link>
      )}
      {can(employee, 'reports.read') && (
        <Link href="/reports" style={styles.card}>
          Consultar estadísticas e ingresos
        </Link>
      )}
    </Screen>
  );
}
