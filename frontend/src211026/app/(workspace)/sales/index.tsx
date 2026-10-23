/**
 * @file
 * Conecta la ruta del área de trabajo con SalesScreen. La lógica vive en features y las
 * restricciones de navegación se completan en layouts y guardas.
 */
import { Guard } from '../../../components/navigation/Guard';
import { SalesScreen } from '../../../features/sales/SalesScreen';
// Exige sales.read mediante Guard antes de montar la pantalla de esta ruta.
export default function SalesRoute() {
  return (
    <Guard permission="sales.read">
      <SalesScreen />
    </Guard>
  );
}
