/**
 * @file
 * Presenta inicio con accesos y métricas permitidos. Coordina la actualización de datos.
 */
import { Link } from 'expo-router';
import { Text, View } from 'react-native';
import { Metrics } from '../../components/metrics/Metrics';
import { Screen } from '../../components/ui/Screen';
import { useTheme } from '../../components/ui/theme';
import { businessDate, displayDate } from '../../domain/dates';
import { can, roleLabels } from '../../domain/permissions';
import { reportRows, totalMetrics } from '../../domain/metrics';
import { useWorkspace } from '../../providers/AppProvider';
import { usePeriodData } from '../../hooks/usePeriodData';
import { Feedback } from '../../components/ui/Feedback';

// Reúne indicadores y accesos operativos según permisos.
export function HomeScreen() {
  const { colors, styles } = useTheme();
  const { employee } = useWorkspace();
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
      <Text style={styles.heading}>{displayDate(today)}</Text>
      <Feedback error={error || refreshError} />
      <Text style={styles.muted}>
        {loading ? 'Cargando…' : refreshing ? 'Actualizando…' : ' '}
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
      <View style={[styles.row, { alignItems: 'stretch' }]}>
        {can(employee, 'photos.read') && (
          <Link
            href="/photos"
            style={[
              styles.card,
              {
                color: colors.text,
                flexGrow: 1,
                flexBasis: 260,
                maxWidth: 440,
                minHeight: 88,
              },
            ]}
          >
            {employee.roleId === 'client' ? 'Ver mis fotos' : 'Consultar fotos'}
          </Link>
        )}
        {can(employee, 'attendance.self') && (
          <Link
            href="/my-attendance"
            style={[
              styles.card,
              {
                color: colors.text,
                flexGrow: 1,
                flexBasis: 260,
                maxWidth: 440,
                minHeight: 88,
              },
            ]}
          >
            Consultar mi asistencia
          </Link>
        )}
        {can(employee, 'sales.read') && (
          <Link
            href="/sales"
            style={[
              styles.card,
              {
                color: colors.text,
                flexGrow: 1,
                flexBasis: 260,
                maxWidth: 440,
                minHeight: 88,
              },
            ]}
          >
            Consultar ventas
          </Link>
        )}
        {can(employee, 'employees.manage') && (
          <Link
            href="/employees/new"
            style={[
              styles.card,
              {
                color: colors.text,
                flexGrow: 1,
                flexBasis: 260,
                maxWidth: 440,
                minHeight: 88,
              },
            ]}
          >
            Alta de usuario
          </Link>
        )}
        {can(employee, 'reports.read') && (
          <Link
            href="/reports"
            style={[
              styles.card,
              {
                color: colors.text,
                flexGrow: 1,
                flexBasis: 260,
                maxWidth: 440,
                minHeight: 88,
              },
            ]}
          >
            Consultar estadísticas e ingresos
          </Link>
        )}
      </View>
    </Screen>
  );
}
