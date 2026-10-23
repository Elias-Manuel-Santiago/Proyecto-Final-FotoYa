import { DataTable } from '../../components/ui/DataTable';
import { money } from '../../domain/format';
/**
 * @file
 * Presenta informes filtrados y resumen del servidor. Distingue días faltantes,
 * inconsistencias e ingresos disponibles.
 */
import { Text } from 'react-native';
import { PeriodFilters } from '../../components/filters/PeriodFilters';
import { Metrics } from '../../components/metrics/Metrics';
import { EmptyState, Feedback } from '../../components/ui/Feedback';
import { Screen } from '../../components/ui/Screen';
import { useTheme } from '../../components/ui/theme';
import {
  reportRows,
  totalMetrics,
  visibleStations,
} from '../../domain/metrics';
import { usePeriodData } from '../../hooks/usePeriodData';
import { usePeriod } from '../../hooks/usePeriod';
import { useWorkspace } from '../../providers/AppProvider';
import { DailyEarnings } from './components/DailyEarnings';

// Consulta informes por período y presenta resumen e ingresos de los puestos filtrados.
export function ReportsScreen() {
  const { styles } = useTheme();
  const { employee } = useWorkspace();
  const { period: filters, update, error: periodError } = usePeriod();
  const ownStationOnly = employee.roleId === 'manager';
  const period = ownStationOnly
    ? { ...filters, stationId: employee.stationId, city: '', event: '' }
    : filters;
  const {
    data,
    loading,
    refreshing,
    reload,
    refreshError,
    error: queryError,
  } = usePeriodData(period);
  const error = periodError || queryError;
  const rows = error ? [] : reportRows(data, employee, period);
  return (
    <Screen
      title="Estadísticas e ingresos"
      refreshing={refreshing}
      onRefresh={reload}
    >
      {ownStationOnly && (
        <Text style={styles.muted}>
          Puesto:{' '}
          {employee.stationName ||
            data.stations.find((station) => station.id === employee.stationId)
              ?.name ||
            'Sin puesto asignado'}
        </Text>
      )}
      <PeriodFilters
        period={period}
        stations={visibleStations(data, employee)}
        onChange={update}
        extended
        allowScopeChange={!ownStationOnly}
      />
      <Feedback error={error || refreshError} />
      <Text style={styles.muted}>
        {loading ? 'Cargando…' : refreshing ? 'Actualizando…' : ' '}
      </Text>
      {!error && !loading && (
        <>
          <Metrics values={data.summary ?? totalMetrics(rows)} />
          {rows.some((row) => row.taken === null) && (
            <Text style={styles.muted}>
              Sin conteo: no se pueden calcular tomadas, descartes ni porcentaje
              del total.
            </Text>
          )}
          {!rows.length && <EmptyState />}
          <DataTable
            label="Estadísticas por puesto"
            columns={[
              'Puesto',
              'Ciudad / evento',
              'Días con conteo',
              'Fotografiadas',
              'Compraron',
              'Descartes',
              'Vendido',
              'Ingresos',
              'Observaciones',
            ]}
            rows={rows.map((row) => ({
              key: row.station.id,
              cells: [
                row.station.name,
                [row.station.city, row.station.event]
                  .filter(Boolean)
                  .join(' · '),
                `${row.registeredDays} de ${row.expectedDays}`,
                row.taken ?? 'Sin conteo',
                row.sold,
                row.discarded ?? 'No disponible',
                row.percentage === null
                  ? 'No aplica'
                  : `${row.percentage.toFixed(1)} %`,
                money(row.earnings),
                row.invalidDays > 0
                  ? `${row.invalidDays} días con ventas superiores al conteo. Revisá los registros.`
                  : '—',
              ],
            }))}
          />
          <DailyEarnings
            data={data}
            stationIds={rows.map((row) => row.station.id)}
            period={period}
          />
        </>
      )}
    </Screen>
  );
}
