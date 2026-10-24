import { Text, View } from 'react-native';
import { displayDate } from '../../domain/dates';
import {
  dailyValues,
  graphicValue,
  periodDates,
  sumGraphicValues,
  type GraphicMetric,
  type GraphicScope,
  type GraphicsData,
} from '../../domain/graphics';
import type { Period } from '../../domain/models';
import { useTheme } from '../ui/theme';
import { MetricChart, formatGraphicValue } from './MetricChart';

export function PeriodGraphic({
  data,
  period,
  scopes,
  metric,
  onDay,
}: {
  data: GraphicsData;
  period: Period;
  scopes: GraphicScope[];
  metric: GraphicMetric;
  onDay: (date: string) => void;
}) {
  const { styles } = useTheme();
  const dates = periodDates(period.from, period.to);
  return (
    <>
      <View style={styles.row}>
        {scopes.map((scope) => (
          <View
            key={scope.id}
            style={[styles.card, { flexGrow: 1, flexBasis: 210 }]}
          >
            <Text style={styles.muted}>{scope.label}</Text>
            <Text style={styles.title}>
              {formatGraphicValue(
                graphicValue(
                  sumGraphicValues(
                    dates.map((date) => dailyValues(data, scope, date)),
                  ),
                  metric,
                ),
                metric,
              )}
            </Text>
            <Text style={styles.muted}>
              {displayDate(period.from)} — {displayDate(period.to)}
            </Text>
          </View>
        ))}
      </View>
      <MetricChart
        title="Evolución del período"
        metric={metric}
        legends={scopes.map((s) => s.label)}
        hint="Tocá un día para ver su distribución por hora. Deslizá el gráfico para recorrer el período."
        points={dates.flatMap((date) =>
          scopes.map((scope, series) => ({
            id: `${date}:${scope.id}`,
            label:
              series === 0 ? date.slice(5).split('-').reverse().join('/') : '',
            description: `${displayDate(date)} · ${scope.label}`,
            value: graphicValue(dailyValues(data, scope, date), metric),
            series,
            onPress: () => onDay(date),
          })),
        )}
      />
    </>
  );
}
