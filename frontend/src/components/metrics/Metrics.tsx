/**
 * @file
 * Presenta indicadores comerciales compartidos. Distingue métricas no disponibles de valores
 * cero.
 */
import { Text, View } from 'react-native';
import { ResponsiveGrid } from '../ui/ResponsiveGrid';
import { useTheme } from '../ui/theme';
import { money } from '../../domain/format';

export interface MetricValues {
  taken: number | null;
  sold: number;
  discarded: number | null;
  percentage: number | null;
  earnings: number;
}

// Presenta indicadores conservando una señal visible cuando un valor es desconocido.
export function Metrics({
  values,
  showMoney = true,
}: {
  values: MetricValues;
  showMoney?: boolean;
}) {
  const { colors, styles } = useTheme();
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
    <View accessibilityLabel="Resumen de estadísticas">
      <ResponsiveGrid minWidth={150}>
        {metrics.map(([label, value]) => (
          <View
            key={label}
            style={[
              styles.card,
              {
                gap: 8,
                minHeight: 116,
                borderTopWidth: 3,
                borderTopColor: colors.brand,
              },
            ]}
          >
            <Text style={styles.muted}>{label}</Text>
            <Text
              style={{
                color: colors.text,
                fontSize: /\d/.test(value) ? 26 : 18,
                lineHeight: 34,
                fontWeight: '700',
              }}
            >
              {value}
            </Text>
          </View>
        ))}
      </ResponsiveGrid>
    </View>
  );
}
