import { Text, View } from 'react-native';
import {
  graphicValue,
  peopleValues,
  type GraphicMetric,
  type GraphicScope,
  type GraphicsData,
} from '../../domain/graphics';
import type { Station } from '../../domain/models';
import { useTheme } from '../ui/theme';
import { MetricChart } from './MetricChart';

export function EmployeeGraphic({
  data,
  scopes,
  metric,
  stations,
  role,
}: {
  data: GraphicsData;
  scopes: GraphicScope[];
  metric: GraphicMetric;
  stations: Station[];
  role: 'seller' | 'editor';
}) {
  const { styles } = useTheme();
  const ids = [...new Set(scopes.flatMap((s) => s.stationIds))];
  const people = peopleValues(data, ids, role);
  return (
    <View style={styles.stack}>
      {role === 'seller' && metric === 'taken' ? (
        <View style={styles.card}>
          <Text style={styles.muted}>
            Las familias fotografiadas se muestran por editor. Elegí otro
            indicador para comparar vendedores.
          </Text>
        </View>
      ) : (
        <MetricChart
          title={
            role === 'seller'
              ? 'Rendimiento por vendedor'
              : 'Rendimiento por editor'
          }
          metric={metric}
          legends={[
            role === 'seller'
              ? 'Ventas registradas por cada persona'
              : 'Resultados de las fotos cargadas por cada persona',
          ]}
          hint={
            role === 'seller'
              ? 'El porcentaje relaciona familias compradoras acreditadas al vendedor con familias cargadas en su puesto durante sus turnos. Los turnos superpuestos comparten esa base; los porcentajes individuales no se suman.'
              : 'Ingresos y ventas vinculados a las fotos cargadas por cada editor. Si una venta incluye varias fotos, el ingreso se reparte entre ellas. Los registros históricos sin autor se agrupan aparte.'
          }
          points={people.map((person) => ({
            id: person.id,
            label: person.name.split(' ')[0],
            description: `${person.name} · ${stations.find((s) => s.id === person.stationId)?.name ?? 'Puesto'}`,
            value: graphicValue(person, metric),
            series: 0,
          }))}
        />
      )}
    </View>
  );
}
