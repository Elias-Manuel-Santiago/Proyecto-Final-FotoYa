import { useState } from 'react';
import { router } from 'expo-router';
import { Text } from 'react-native';
import { PeriodFilters } from '../../components/filters/PeriodFilters';
import { EmployeeGraphic } from '../../components/graphics/EmployeeGraphic';
import { PeriodGraphic } from '../../components/graphics/PeriodGraphic';
import { ScopePicker } from '../../components/graphics/ScopePicker';
import { Feedback } from '../../components/ui/Feedback';
import { Screen } from '../../components/ui/Screen';
import { Select } from '../../components/ui/Select';
import { Button } from '../../components/ui/Button';
import { useTheme } from '../../components/ui/theme';
import {
  graphicMetrics,
  graphicScopes,
  type GraphicMetric,
} from '../../domain/graphics';
import { visibleStations } from '../../domain/metrics';
import { useGraphicsData } from '../../hooks/useGraphicsData';
import { usePeriod } from '../../hooks/usePeriod';
import { useWorkspace } from '../../providers/AppProvider';
import { ReportDetails } from './components/ReportDetails';

export function ReportsScreen() {
  const { styles } = useTheme();
  const { employee, data: base } = useWorkspace();
  const { period, update } = usePeriod();
  const own = employee.roleId === 'manager';
  const stations = visibleStations(base, employee);
  const available = graphicScopes(stations, own);
  const [selected, setSelected] = useState<string[]>(
    own ? [`station:${employee.stationId}`] : ['total'],
  );
  const [metric, setMetric] = useState<GraphicMetric>('earnings');
  const scopes = own
    ? available
    : available.filter((s) => selected.includes(s.id));
  const { data, loading, refreshing, error, reload } = useGraphicsData(period);
  return (
    <Screen
      title="Estadísticas e ingresos"
      refreshing={refreshing}
      onRefresh={reload}
    >
      {own && (
        <Text style={styles.heading}>
          Puesto: {stations[0]?.name ?? employee.stationName ?? 'Tu puesto'}
        </Text>
      )}
      <PeriodFilters
        period={period}
        stations={stations}
        onChange={update}
        allowScopeChange={false}
      />
      {!own && (
        <ScopePicker
          scopes={available}
          selected={selected}
          onChange={setSelected}
        />
      )}
      <Select
        label="Indicador de los gráficos"
        value={metric}
        options={graphicMetrics}
        onChange={(v) => setMetric(v as GraphicMetric)}
      />
      <Text style={styles.muted}>
        Ventas: operaciones registradas, incluidas compras repetidas. Precio por
        venta: ingresos / operaciones. Conversión: familias compradoras /
        familias fotografiadas.
      </Text>
      <Feedback error={error} />
      {loading && <Text style={styles.muted}>Cargando gráficos…</Text>}
      {!!error && (
        <Button secondary title="Reintentar gráficos" onPress={reload} />
      )}
      {!scopes.length && (
        <Text style={styles.muted}>
          Seleccioná al menos una serie para ver los gráficos.
        </Text>
      )}
      {data && !!scopes.length && (
        <>
          <PeriodGraphic
            data={data}
            period={period}
            scopes={scopes}
            metric={metric}
            onDay={(day) =>
              router.push({
                pathname: '/reports/day',
                params: {
                  day,
                  from: period.from,
                  to: period.to,
                  metric,
                  scopes: JSON.stringify(scopes.map((s) => s.id)),
                },
              })
            }
          />
          <EmployeeGraphic
            data={data}
            scopes={scopes}
            metric={metric}
            stations={stations}
          />
          <ReportDetails
            data={data}
            scopes={scopes}
            stations={stations}
            period={period}
          />
        </>
      )}
    </Screen>
  );
}
