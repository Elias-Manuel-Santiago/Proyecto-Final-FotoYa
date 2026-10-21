/**
 * @file
 * Presenta ingresos diarios del período. Usa datos comerciales sin tratarlos como ganancias
 * netas.
 */
import { Text, View } from 'react-native';
import type { AppData, Period } from '../../../domain/models';
import { displayDate } from '../../../domain/dates';
import { money } from '../../../domain/format';
import { matchesPeriod } from '../../../domain/metrics';
import { sumAmounts } from '../../../domain/amounts';
import { EmptyState } from '../../../components/ui/Feedback';
import { styles } from '../../../components/ui/theme';

// Agrupa ingresos por fecha para los puestos y el período seleccionados.
export function DailyEarnings({
  data,
  stationIds,
  period,
}: {
  data: AppData;
  stationIds: string[];
  period: Period;
}) {
  const sales = data.sales.filter(
    (sale) =>
      stationIds.includes(sale.stationId) && matchesPeriod(sale, period),
  );
  const dates = Array.from(
    new Set([
      ...sales.map((sale) => sale.date),
      ...data.counts
        .filter(
          (row) =>
            stationIds.includes(row.stationId) && matchesPeriod(row, period),
        )
        .map((row) => row.date),
    ]),
  )
    .sort()
    .reverse();
  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Ingresos diarios</Text>
      <Text style={styles.muted}>
        Importes históricos de ventas. Las ganancias netas requieren una
        definición de costos.
      </Text>
      {!dates.length && <EmptyState />}
      {dates.map((date) => (
        <Text key={date} style={styles.text}>
          {displayDate(date)}:{' '}
          {money(
            data.counts.some(
              (row) =>
                stationIds.includes(row.stationId) &&
                row.date === date &&
                row.revenue !== undefined,
            )
              ? sumAmounts(
                  data.counts
                    .filter(
                      (row) =>
                        stationIds.includes(row.stationId) && row.date === date,
                    )
                    .map((row) => row.revenue ?? 0),
                )
              : sumAmounts(
                  sales
                    .filter((sale) => sale.date === date)
                    .map((sale) => sale.total),
                ),
          )}
        </Text>
      ))}
    </View>
  );
}
