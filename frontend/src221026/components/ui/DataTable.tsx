import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import { useTheme } from './theme';
export function DataTable({
  columns,
  rows,
  label,
}: {
  columns: string[];
  rows: { key: string; cells: (string | number)[] }[];
  label: string;
}) {
  const { colors, styles } = useTheme();
  const minWidth = columns.length * 150;
  const [width, setWidth] = useState(0);
  return (
    <View
      onLayout={(event) => setWidth(event.nativeEvent.layout.width)}
      style={{ gap: 6 }}
    >
      {width > 0 && width < minWidth && (
        <Text style={styles.muted}>
          Deslizá horizontalmente para ver todas las columnas.
        </Text>
      )}
      <ScrollView horizontal contentContainerStyle={{ flexGrow: 1 }}>
        <View
          role="table"
          accessibilityLabel={label}
          style={{
            flexGrow: 1,
            minWidth,
            borderWidth: 1,
            borderColor: colors.border,
            borderRadius: 14,
            overflow: 'hidden',
          }}
        >
          <View
            role="row"
            style={{ flexDirection: 'row', backgroundColor: colors.lavender }}
          >
            {columns.map((column) => (
              <View
                role="columnheader"
                key={column}
                style={{ flex: 1, minWidth: 150, padding: 14 }}
              >
                <Text style={styles.label}>{column}</Text>
              </View>
            ))}
          </View>
          {rows.map((row, index) => (
            <View
              role="row"
              key={row.key}
              style={{
                flexDirection: 'row',
                backgroundColor: index % 2 ? colors.background : colors.surface,
                borderTopWidth: 1,
                borderColor: colors.border,
              }}
            >
              {row.cells.map((cell, i) => (
                <View
                  role="cell"
                  key={i}
                  style={{
                    flex: 1,
                    minWidth: 150,
                    padding: 14,
                    justifyContent: 'center',
                  }}
                >
                  <Text style={styles.text}>{cell}</Text>
                </View>
              ))}
            </View>
          ))}
          {!rows.length && (
            <Text style={[styles.muted, { padding: 16 }]}>
              No hay registros para estos filtros.
            </Text>
          )}
        </View>
      </ScrollView>
    </View>
  );
}
