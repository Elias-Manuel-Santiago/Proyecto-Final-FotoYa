import { ResponsiveGrid } from '../../components/ui/ResponsiveGrid';
import { useState } from 'react';
import { SortControl } from '../../components/filters/SortControl';
/**
 * @file
 * Consulta ventas por período y presenta tarjetas. Habilita acceso al registro en evento según
 * permiso.
 */
import { Link } from 'expo-router';
import { Text } from 'react-native';
import { PeriodFilters } from '../../components/filters/PeriodFilters';
import { Metrics } from '../../components/metrics/Metrics';
import { EmptyState, Feedback } from '../../components/ui/Feedback';
import { Screen } from '../../components/ui/Screen';
import { useTheme } from '../../components/ui/theme';
import {
  matchesPeriod,
  reportRows,
  totalMetrics,
  visibleStations,
} from '../../domain/metrics';
import { can, hasStationAccess } from '../../domain/permissions';
import { usePeriodData } from '../../hooks/usePeriodData';
import { usePeriod } from '../../hooks/usePeriod';
import { useWorkspace } from '../../providers/AppProvider';
import { SaleCard } from './components/SaleCard';

// Filtra ventas históricas por período y muestra importes y detalles.
export function SalesScreen() {
  const [ascending, setAscending] = useState(false);
  const { styles } = useTheme();
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
  const sales = error
    ? []
    : data.sales
        .filter(
          (sale) =>
            hasStationAccess(employee, sale.stationId) &&
            matchesPeriod(sale, period),
        )
        .sort(
          (a, b) =>
            (ascending ? 1 : -1) * a.createdAt.localeCompare(b.createdAt),
        );
  return (
    <Screen title="Ventas" refreshing={refreshing} onRefresh={reload}>
      {can(employee, 'sales.create') && (
        <Link href="/sales/new" style={[styles.card, styles.text]}>
          Registrar venta en evento
        </Link>
      )}
      <PeriodFilters
        period={period}
        stations={visibleStations(data, employee)}
        onChange={update}
      >
        <SortControl ascending={ascending} onChange={setAscending} />
      </PeriodFilters>
      <Feedback error={error || refreshError} />
      {(loading || refreshing) && (
        <Text accessibilityLiveRegion="polite" style={styles.muted}>
          {loading ? 'Cargando…' : 'Actualizando…'}
        </Text>
      )}
      {!error && !loading && (
        <>
          <Metrics
            values={
              data.summary ?? totalMetrics(reportRows(data, employee, period))
            }
          />
          <Text style={styles.muted}>{sales.length} operaciones</Text>
          {!sales.length && <EmptyState />}
          <ResponsiveGrid>
            {sales.map((sale) => (
              <SaleCard key={sale.id} sale={sale} data={data} />
            ))}
          </ResponsiveGrid>
        </>
      )}
    </Screen>
  );
}
