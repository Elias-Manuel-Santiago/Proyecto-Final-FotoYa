import { displayDate } from '../../domain/dates';
import {
  dailyValues,
  graphicValue,
  periodDates,
  type GraphicMetric,
  type GraphicScope,
  type GraphicsData,
} from '../../domain/graphics';
import type { Period } from '../../domain/models';
import { MetricChart } from './MetricChart';

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
  const dates = periodDates(period.from, period.to);
  return (
    <>
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
