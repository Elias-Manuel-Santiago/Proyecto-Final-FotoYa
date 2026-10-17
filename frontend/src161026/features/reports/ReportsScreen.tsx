import { Button } from '../../components/ui/Button';
import { Text, View } from 'react-native';
import { PeriodFilters } from '../../components/filters/PeriodFilters';
import { Metrics } from '../../components/metrics/Metrics';
import { EmptyState, Feedback } from '../../components/ui/Feedback';
import { Screen } from '../../components/ui/Screen';
import { styles } from '../../components/ui/theme';
import {
  reportRows,
  totalMetrics,
  visibleStations,
} from '../../domain/metrics';
import { usePeriodData } from '../../hooks/usePeriodData';
import { usePeriod } from '../../hooks/usePeriod';
import { useWorkspace } from '../../providers/AppProvider';
import { DailyEarnings } from './components/DailyEarnings';

export function ReportsScreen() {
  const { employee } = useWorkspace();
  const { period, update, error: periodError } = usePeriod();
  const { data, loading, reload, error: queryError } = usePeriodData(period);
  const error = periodError || queryError;
  const rows = error ? [] : reportRows(data, employee, period);
  return (
    <Screen title="Estadísticas e ingresos">
      <PeriodFilters
        period={period}
        stations={visibleStations(data, employee)}
        onChange={update}
        extended
      />
      <Feedback error={error} />
      <Button
        title="Actualizar datos"
        secondary
        busy={loading}
        onPress={reload}
      />
      {loading && <Text style={styles.muted}>Consultando servidor…</Text>}
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
          {rows.map((row) => (
            <View key={row.station.id} style={styles.card}>
              <Text style={styles.heading}>{row.station.name}</Text>
              <Text style={styles.muted}>
                {row.station.city} · {row.station.event}
              </Text>
              <Text style={styles.muted}>{row.station.address}</Text>
              <Text style={styles.muted}>
                Días con conteo: {row.registeredDays} de {row.expectedDays}
              </Text>
              {row.invalidDays > 0 && (
                <Text style={styles.error}>
                  {row.invalidDays} días con ventas superiores al conteo. Revisá
                  los registros.
                </Text>
              )}
              <Metrics values={row} />
            </View>
          ))}
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
