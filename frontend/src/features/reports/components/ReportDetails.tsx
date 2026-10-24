import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '../../../components/ui/Button';
import { DataTable } from '../../../components/ui/DataTable';
import { useTheme } from '../../../components/ui/theme';
import { money } from '../../../domain/format';
import { stationMetrics } from '../../../domain/metrics';
import type { AppData, Period, Station } from '../../../domain/models';
import type { GraphicsData, GraphicScope } from '../../../domain/graphics';

/** Conserva cobertura e inconsistencias del informe tabular junto a los gráficos. */
export function ReportDetails({
  data,
  scopes,
  stations,
  period,
}: {
  data: GraphicsData;
  scopes: GraphicScope[];
  stations: Station[];
  period: Period;
}) {
  const [open, setOpen] = useState(false);
  const { styles } = useTheme();
  const ids = new Set(scopes.flatMap((s) => s.stationIds));
  const snapshot: AppData = {
    employees: [],
    stations,
    photos: [],
    sales: [],
    attendance: [],
    counts: data.days.flatMap((row) =>
      row.taken === null
        ? []
        : [
            {
              stationId: row.stationId,
              date: row.date,
              taken: row.taken,
              sold: row.sold,
              revenue: row.earnings,
            },
          ],
    ),
  };
  return (
    <View style={styles.card}>
      <Button
        secondary
        title={open ? 'Ocultar resumen por puesto' : 'Ver resumen por puesto'}
        onPress={() => setOpen((v) => !v)}
      />
      {open && (
        <DataTable
          label="Estadísticas por puesto"
          columns={[
            'Puesto',
            'Ciudad / evento',
            'Días con conteo',
            'Fotografiadas',
            'Familias compradoras',
            'Descartes',
            'Vendido',
            'Ingresos',
            'Observaciones',
          ]}
          rows={stations
            .filter((s) => ids.has(s.id))
            .map((station) => {
              const row = stationMetrics(snapshot, station, period);
              return {
                key: station.id,
                cells: [
                  station.name,
                  [station.city, station.event].filter(Boolean).join(' · '),
                  `${row.registeredDays} de ${row.expectedDays}`,
                  row.taken ?? 'Sin conteo',
                  row.sold,
                  row.discarded ?? 'No disponible',
                  row.percentage === null
                    ? 'No aplica'
                    : `${row.percentage.toFixed(1)} %`,
                  money(row.earnings),
                  row.invalidDays
                    ? `${row.invalidDays} días con ventas superiores al conteo. Revisá los registros.`
                    : '—',
                ],
              };
            })}
        />
      )}
    </View>
  );
}
