import { useState } from 'react';
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
import { Select } from '../ui/Select';
import { MetricChart } from './MetricChart';

export function EmployeeGraphic({
  data,
  scopes,
  metric,
  stations,
}: {
  data: GraphicsData;
  scopes: GraphicScope[];
  metric: GraphicMetric;
  stations: Station[];
}) {
  const { styles } = useTheme();
  const [role, setRole] = useState<'seller' | 'photographer'>('seller');
  const ids = [...new Set(scopes.flatMap((s) => s.stationIds))];
  const people = peopleValues(data, ids, role);
  return (
    <View style={styles.stack}>
      <Select
        label="Rendimiento del equipo"
        value={role}
        options={[
          { value: 'seller', label: 'Vendedores' },
          { value: 'photographer', label: 'Camarógrafos' },
        ]}
        onChange={(value) => setRole(value as typeof role)}
      />
      {role === 'seller' && metric === 'taken' ? (
        <View style={styles.card}>
          <Text style={styles.muted}>
            Las familias fotografiadas se muestran por camarógrafo. Elegí otro
            indicador para comparar vendedores.
          </Text>
        </View>
      ) : (
        <MetricChart
          title={
            role === 'seller'
              ? 'Rendimiento por vendedor'
              : 'Rendimiento por camarógrafo'
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
              : 'Ingresos y ventas vinculados a las fotos cargadas por cada camarógrafo. Si una venta incluye varias fotos, el ingreso se reparte entre ellas. Los registros históricos sin autor se agrupan aparte.'
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
