import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { BarChart } from 'react-native-gifted-charts';
import { useTheme } from '../ui/theme';
import { Button } from '../ui/Button';
import { money } from '../../domain/format';
import { graphicMetrics, type GraphicMetric } from '../../domain/graphics';

export interface GraphicPoint {
  id: string;
  label: string;
  description: string;
  value: number | null;
  series: number;
  onPress?: () => void;
}
export function formatGraphicValue(
  value: number | null,
  metric: GraphicMetric,
) {
  if (value === null) return 'Sin datos suficientes';
  if (metric === 'earnings' || metric === 'average') return money(value);
  return `${new Intl.NumberFormat('es-AR', { maximumFractionDigits: 1 }).format(value)}${metric === 'percentage' ? ' %' : ''}`;
}

/** Base compartida: gráfica desplazable y listado accesible para valores cero o desconocidos. */
export function MetricChart({
  title,
  metric,
  points,
  legends,
  hint,
}: {
  title: string;
  metric: GraphicMetric;
  points: GraphicPoint[];
  legends: string[];
  hint?: string;
}) {
  const { colors, styles } = useTheme();
  const palette = [
    colors.primary,
    colors.success,
    colors.muted,
    colors.brand,
    colors.text,
  ];
  const [width, setWidth] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [page, setPage] = useState(0);
  const [focused, setFocused] = useState<string>();
  const selected = points.find((p) => p.id === focused);
  const max = Math.max(1, ...points.map((p) => p.value ?? 0));
  const pageCount = Math.max(1, Math.ceil(points.length / 24));
  const currentPage = Math.min(page, pageCount - 1);
  const barWidth = Math.max(
    24,
    Math.min(56, ((width - 88) / Math.max(points.length, 1)) * 0.65),
  );
  const spacing =
    points.length > 1
      ? Math.max(10, (width - 100) / points.length - barWidth)
      : 20;
  return (
    <View
      style={styles.card}
      onLayout={(e) => setWidth(e.nativeEvent.layout.width - 34)}
    >
      <Text accessibilityRole="header" style={styles.heading}>
        {title}
      </Text>
      <Text style={styles.muted}>
        {graphicMetrics.find((m) => m.value === metric)?.label}
      </Text>
      <View style={styles.row}>
        {legends.map((label, index) => (
          <View
            key={`${index}:${label}`}
            style={[styles.row, { flexShrink: 1 }]}
          >
            <View
              style={{
                width: 12,
                height: 12,
                borderRadius: 4,
                backgroundColor: palette[index % palette.length],
              }}
            />
            <Text style={[styles.muted, { flexShrink: 1 }]}>{label}</Text>
          </View>
        ))}
      </View>
      {!!hint && <Text style={styles.muted}>{hint}</Text>}
      {points.some((p) => p.value === null) && (
        <Text style={styles.muted}>
          Los valores sin datos suficientes se muestran en el listado, sin
          convertirlos en cero.
        </Text>
      )}
      {!points.length ? (
        <Text style={styles.muted}>No hay datos para esta selección.</Text>
      ) : (
        width > 80 && (
          <View style={{ overflow: 'hidden', paddingTop: 18 }}>
            <BarChart
              key={`${metric}:${legends.join('|')}`}
              data={points.map((point) => ({
                value: point.value ?? 0,
                label: point.label,
                frontColor:
                  point.value === null
                    ? colors.border
                    : palette[point.series % palette.length],
                onPress: () => {
                  setFocused(point.id);
                  point.onPress?.();
                },
                labelTextStyle: { color: colors.muted, fontSize: 11 },
              }))}
              width={Math.max(80, width - 64)}
              height={220}
              barWidth={barWidth}
              spacing={spacing}
              barBorderRadius={5}
              maxValue={max * 1.1}
              noOfSections={4}
              yAxisLabelWidth={54}
              yAxisTextStyle={{ color: colors.muted, fontSize: 10 }}
              xAxisColor={colors.border}
              yAxisColor={colors.border}
              rulesColor={colors.border}
              formatYLabel={(label) =>
                new Intl.NumberFormat('es-AR', {
                  notation: 'compact',
                  maximumFractionDigits: 1,
                }).format(Number(label))
              }
              showScrollIndicator
              initialSpacing={
                points.length === 1
                  ? Math.max(12, (width - 88 - barWidth) / 2)
                  : 12
              }
            />
          </View>
        )
      )}
      {selected && (
        <Text accessibilityLiveRegion="polite" style={styles.label}>
          {selected.description}: {formatGraphicValue(selected.value, metric)}
        </Text>
      )}
      {!!points.length && (
        <>
          <Button
            secondary
            title={expanded ? 'Ocultar valores' : 'Ver valores y detalles'}
            onPress={() => setExpanded((v) => !v)}
          />
          {expanded && (
            <View style={styles.stack}>
              {points
                .slice(currentPage * 24, currentPage * 24 + 24)
                .map((point) => (
                  <Pressable
                    key={point.id}
                    accessibilityRole={point.onPress ? 'button' : undefined}
                    accessibilityLabel={`${point.description}: ${formatGraphicValue(point.value, metric)}${point.onPress ? '. Ver detalle' : ''}`}
                    onPress={() => {
                      setFocused(point.id);
                      point.onPress?.();
                    }}
                    style={[
                      styles.row,
                      {
                        minHeight: 48,
                        paddingVertical: 10,
                        borderBottomWidth: 1,
                        borderColor: colors.border,
                        justifyContent: 'space-between',
                      },
                    ]}
                  >
                    <Text style={[styles.text, { flexShrink: 1 }]}>
                      {point.description}
                    </Text>
                    <Text style={styles.label}>
                      {formatGraphicValue(point.value, metric)}
                      {point.onPress ? '  ›' : ''}
                    </Text>
                  </Pressable>
                ))}
              {pageCount > 1 && (
                <View style={styles.row}>
                  <Button
                    secondary
                    title="Anteriores"
                    disabled={!currentPage}
                    onPress={() => setPage(currentPage - 1)}
                  />
                  <Text style={styles.muted}>
                    {currentPage + 1} / {pageCount}
                  </Text>
                  <Button
                    secondary
                    title="Siguientes"
                    disabled={currentPage + 1 >= pageCount}
                    onPress={() => setPage(currentPage + 1)}
                  />
                </View>
              )}
            </View>
          )}
        </>
      )}
    </View>
  );
}
