import { Text, View } from 'react-native';
import { money } from '../../domain/format';
import { styles } from '../ui/theme';

export interface MetricValues {
  taken: number | null;
  sold: number;
  discarded: number | null;
  percentage: number | null;
  earnings: number;
}

export function Metrics({
  values,
  showMoney = true,
}: {
  values: MetricValues;
  showMoney?: boolean;
}) {
  const metrics = [
    [
      'Familias fotografiadas',
      values.taken === null ? 'Sin conteo' : String(values.taken),
    ],
    ['Familias que compraron', String(values.sold)],
    [
      'Descartes',
      values.discarded === null ? 'No disponible' : String(values.discarded),
    ],
    [
      'Porcentaje vendido',
      values.percentage === null
        ? 'No aplica'
        : `${values.percentage.toFixed(1)} %`,
    ],
    ...(showMoney ? [['Ingresos por ventas', money(values.earnings)]] : []),
  ];
  return (
    <View style={styles.row}>
      {metrics.map(([label, value]) => (
        <View key={label} style={[styles.card, { flexGrow: 1, minWidth: 130 }]}>
          <Text style={styles.muted}>{label}</Text>
          <Text style={styles.heading}>{value}</Text>
        </View>
      ))}
    </View>
  );
}
