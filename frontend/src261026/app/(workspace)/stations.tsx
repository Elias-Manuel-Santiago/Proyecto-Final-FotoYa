/**
 * @file
 * Conecta la ruta del área de trabajo con StationsScreen. La lógica vive en features y las
 * restricciones de navegación se completan en layouts y guardas.
 */
import { Guard } from '../../components/navigation/Guard';
import { StationsScreen } from '../../features/stations/StationsScreen';
// Exige catalog.read y alcance global mediante Guard antes de montar la pantalla de esta ruta.
export default function StationsRoute() {
  return (
    <Guard permission="catalog.read" roles={['owner', 'secretary']}>
      <StationsScreen />
    </Guard>
  );
}
