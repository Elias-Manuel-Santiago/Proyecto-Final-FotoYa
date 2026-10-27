import { Text, View } from 'react-native';
import {
  graphicValue,
  peopleValues,
  type GraphicMetric,
  type GraphicPerson,
  type GraphicScope,
  type GraphicsData,
} from '../../domain/graphics';
import type { Station } from '../../domain/models';
import { useTheme } from '../ui/theme';
import { MetricChart } from './MetricChart';

const roleLabels = {
  seller: 'Vendedores',
  cameraman: 'Camarógrafos',
  editor: 'Editores',
};
export function EmployeeGraphic({
  data,
  scopes,
  metric,
  stations,
  roles,
}: {
  data: GraphicsData;
  scopes: GraphicScope[];
  metric: GraphicMetric;
  stations: Station[];
  roles: GraphicPerson['role'][];
}) {
  const { styles } = useTheme();
  const ids = [...new Set(scopes.flatMap((scope) => scope.stationIds))];
  const chartRoles = roles.filter(
    (role) => metric !== 'taken' || role !== 'seller',
  );
  const people = peopleValues(data, ids, chartRoles);
  if (!roles.length)
    return (
      <Text style={styles.muted}>
        Seleccioná al menos un rol para comparar el equipo.
      </Text>
    );
  if (!chartRoles.length)
    return (
      <View style={styles.card}>
        <Text style={styles.muted}>
          Las familias fotografiadas se muestran por camarógrafo o editor.
          Seleccioná esos roles u otro indicador para comparar vendedores.
        </Text>
      </View>
    );
  return (
    <View style={styles.stack}>
      <MetricChart
        title="Rendimiento del equipo"
        metric={metric}
        legends={[chartRoles.map((role) => roleLabels[role]).join(' · ')]}
        hint="Vendedores: ventas registradas y oportunidades durante sus turnos. Camarógrafos y editores: resultados de las fotos atribuidas a cada autor. Una misma venta puede aparecer en funciones diferentes; esos resultados no se suman. Los registros sin autor se agrupan aparte."
        points={people.map((person) => ({
          id: person.id,
          label: person.name.split(' ')[0],
          description: `${person.name} · ${roleLabels[person.role]} · ${stations.find((station) => station.id === person.stationId)?.name ?? 'Puesto'}`,
          value: graphicValue(person, metric),
          series: 0,
        }))}
      />
    </View>
  );
}
