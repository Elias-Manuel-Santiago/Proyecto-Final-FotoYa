import { useLocalSearchParams, router } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { DailyGraphic } from '../../components/graphics/DailyGraphic';
import { PeriodGraphic } from '../../components/graphics/PeriodGraphic';
import { ScopePicker } from '../../components/graphics/ScopePicker';
import { PeriodFilters } from '../../components/filters/PeriodFilters';
import { Button } from '../../components/ui/Button';
import { Feedback } from '../../components/ui/Feedback';
import { Screen } from '../../components/ui/Screen';
import { Select } from '../../components/ui/Select';
import { useTheme } from '../../components/ui/theme';
import { displayDate, periodError, validDate } from '../../domain/dates';
import {
  graphicMetrics,
  graphicScopes,
  type GraphicMetric,
} from '../../domain/graphics';
import { visibleStations } from '../../domain/metrics';
import { useGraphicsData } from '../../hooks/useGraphicsData';
import { useWorkspace } from '../../providers/AppProvider';

export function DayReportScreen() {
  const params = useLocalSearchParams<{
    day?: string;
    metric?: string;
    scopes?: string;
    from?: string;
    to?: string;
    allTime?: string;
  }>();
  const { styles } = useTheme();
  const { employee, data: base } = useWorkspace();
  const own = employee.roleId === 'manager';
  const [day, setDay] = useState(
    typeof params.day === 'string' && validDate(params.day) ? params.day : '',
  );
  const [allTime, setAllTime] = useState(false);
  const [metric, setMetric] = useState<GraphicMetric>(
    graphicMetrics.find((m) => m.value === params.metric)?.value ?? 'earnings',
  );
  const [selected, setSelected] = useState<string[]>(() => {
    try {
      const ids: unknown = JSON.parse(params.scopes ?? '["total"]');
      return Array.isArray(ids)
        ? ids.filter((id): id is string => typeof id === 'string')
        : [];
    } catch {
      return ['total'];
    }
  });
  const stations = visibleStations(base, employee);
  const available = graphicScopes(stations, own);
  const scopes = own
    ? available
    : available.filter((s) => selected.includes(s.id));
  const period = {
    from: day,
    to: day,
    stationId: own ? employee.stationId : '',
    allTime,
  };
  const { data, loading, refreshing, error, reload } = useGraphicsData(
    period,
    allTime ? undefined : day || undefined,
  );
  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/reports');
  };
  return (
    <Screen
      title={
        allTime
          ? 'Detalle de siempre'
          : day
            ? `Detalle del ${displayDate(day)}`
            : 'Detalle diario'
      }
      refreshing={refreshing}
      onRefresh={reload}
    >
      <Button secondary title="Volver al período" onPress={goBack} />
      {params.allTime === 'true' ? (
        <Text style={styles.muted}>Período de origen: Siempre</Text>
      ) : (
        day &&
        typeof params.from === 'string' &&
        typeof params.to === 'string' &&
        !periodError(params.from, params.to) && (
          <Text style={styles.muted}>
            Período de origen: {displayDate(params.from)} —{' '}
            {displayDate(params.to)}
          </Text>
        )
      )}
      {own && (
        <Text style={styles.heading}>
          Puesto: {stations[0]?.name ?? employee.stationName ?? 'Tu puesto'}
        </Text>
      )}
      <PeriodFilters
        singleDay
        period={period}
        stations={stations}
        allowScopeChange={false}
        onChange={(value) => {
          setAllTime(!!value.allTime);
          if (value.from) setDay(value.from);
        }}
        indicator={
          <Select
            label="Indicador del gráfico diario"
            value={metric}
            options={graphicMetrics}
            onChange={(v) => setMetric(v as GraphicMetric)}
          />
        }
        scopePicker={
          !own ? (
            <ScopePicker
              scopes={available}
              selected={selected}
              onChange={setSelected}
            />
          ) : undefined
        }
      />
      <Feedback error={error} />
      {loading && (
        <Text style={styles.muted}>Cargando distribución horaria…</Text>
      )}
      {!!error && !!day && (
        <Button secondary title="Reintentar detalle" onPress={reload} />
      )}
      {!scopes.length && (
        <Text style={styles.muted}>Seleccioná al menos una serie.</Text>
      )}
      {data &&
        !!scopes.length &&
        (allTime ? (
          <PeriodGraphic
            data={data}
            period={period}
            scopes={scopes}
            metric={metric}
            onDay={(date) => {
              setDay(date);
              setAllTime(false);
            }}
          />
        ) : (
          day && (
            <DailyGraphic
              data={data}
              day={day}
              scopes={scopes}
              metric={metric}
              stations={stations}
            />
          )
        ))}
    </Screen>
  );
}
