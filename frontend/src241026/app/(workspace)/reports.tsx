/**
 * @file
 * Conecta la ruta del área de trabajo con ReportsScreen. La lógica vive en features y las
 * restricciones de navegación se completan en layouts y guardas.
 */
import { Guard } from '../../components/navigation/Guard';
import { ReportsScreen } from '../../features/reports/ReportsScreen';
// Exige reports.read mediante Guard antes de montar la pantalla de esta ruta.
export default function ReportsRoute() {
  return (
    <Guard permission="reports.read">
      <ReportsScreen />
    </Guard>
  );
}
