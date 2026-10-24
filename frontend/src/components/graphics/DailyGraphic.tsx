import { useState } from 'react';
import { Modal, ScrollView, Text, View } from 'react-native';
import { displayDate, displayInstant } from '../../domain/dates';
import {
  graphicValue,
  hourlyValues,
  workersAtHour,
  type GraphicMetric,
  type GraphicScope,
  type GraphicsData,
} from '../../domain/graphics';
import type { Station } from '../../domain/models';
import { useTheme } from '../ui/theme';
import { Button } from '../ui/Button';
import { MetricChart } from './MetricChart';

export function DailyGraphic({
  data,
  day,
  scopes,
  metric,
  stations,
}: {
  data: GraphicsData;
  day: string;
  scopes: GraphicScope[];
  metric: GraphicMetric;
  stations: Station[];
}) {
  const { styles } = useTheme();
  const [selection, setSelection] = useState<{
    hour: number;
    scopeId: string;
  }>();
  const selectedScope = scopes.find((s) => s.id === selection?.scopeId);
  const present =
    selection && selectedScope
      ? workersAtHour(
          data.attendance,
          selectedScope.stationIds,
          day,
          selection.hour,
        )
      : [];
  const hours: (number | null)[] = Array.from(
    { length: 24 },
    (_, hour) => hour,
  );
  if (
    data.hours.some(
      (r) =>
        r.hour === null &&
        scopes.some((s) => s.stationIds.includes(r.stationId)) &&
        (r.sales || r.taken || r.earnings),
    )
  )
    hours.push(null);
  const hourLabel = (hour: number | null) =>
    hour === null ? 'Sin hora' : `${String(hour).padStart(2, '0')}:00`;
  return (
    <>
      <MetricChart
        title={`Por hora · ${displayDate(day)}`}
        metric={metric}
        legends={scopes.map((s) => s.label)}
        hint="Horario de Argentina. Las fotos usan la hora de carga registrada. Tocá una hora para ver quiénes trabajaban en los puestos de esa serie. Los registros sin hora se conservan aparte."
        points={hours.flatMap((hour) =>
          scopes.map((scope, series) => ({
            id: `${hour}:${scope.id}`,
            label: series === 0 ? hourLabel(hour) : '',
            description: `${hourLabel(hour)} · ${scope.label}`,
            value: graphicValue(hourlyValues(data, scope, day, hour), metric),
            series,
            onPress:
              hour === null
                ? undefined
                : () => setSelection({ hour, scopeId: scope.id }),
          })),
        )}
      />
      <Modal
        visible={!!selection && !!selectedScope}
        transparent
        animationType="fade"
        onRequestClose={() => setSelection(undefined)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: '#00000080',
            padding: 16,
            justifyContent: 'center',
          }}
        >
          <View
            accessibilityViewIsModal
            style={[
              styles.card,
              {
                maxWidth: 760,
                width: '100%',
                maxHeight: '85%',
                alignSelf: 'center',
              },
            ]}
          >
            <Text accessibilityRole="header" style={styles.heading}>
              Personal presente · {selection ? hourLabel(selection.hour) : ''}
            </Text>
            <Text style={styles.muted}>
              {displayDate(day)} · {selectedScope?.label}
            </Text>
            <Text style={styles.muted}>
              Turnos que coincidieron con cualquier parte de esta hora. Un turno
              abierto conserva la última entrada registrada.
            </Text>
            <ScrollView contentContainerStyle={{ gap: 16 }}>
              {stations
                .filter((s) => selectedScope?.stationIds.includes(s.id))
                .map((station) => {
                  const shifts = present.filter(
                    (r) => r.stationId === station.id,
                  );
                  return (
                    <View key={station.id} style={styles.card}>
                      <Text style={styles.label}>{station.name}</Text>
                      {!shifts.length && (
                        <Text style={styles.muted}>
                          Sin turnos registrados en esta hora.
                        </Text>
                      )}
                      {shifts.map((shift) => (
                        <View key={shift.id} style={styles.stack}>
                          <Text style={styles.text}>
                            {shift.name} ·{' '}
                            {(
                              {
                                vendedor: 'Vendedor',
                                camarografo: 'Camarógrafo',
                                encargado: 'Encargado',
                                secretario: 'Secretario',
                                dueno: 'Dueño',
                              } as Record<string, string>
                            )[shift.role] ?? shift.role}
                          </Text>
                          <Text style={styles.muted}>
                            {displayInstant(shift.checkIn)} —{' '}
                            {shift.checkOut
                              ? displayInstant(shift.checkOut)
                              : shift.closedAt
                                ? 'No hizo check-out'
                                : 'Turno abierto'}
                          </Text>
                        </View>
                      ))}
                    </View>
                  );
                })}
            </ScrollView>
            <Button
              title="Cerrar detalle horario"
              onPress={() => setSelection(undefined)}
            />
          </View>
        </View>
      </Modal>
    </>
  );
}
