/**
 * @file
 * Conecta la ruta del área de trabajo con EmployeeDetailScreen. La lógica vive en features y
 * las restricciones de navegación se completan en layouts y guardas.
 */
import { Guard } from '../../../components/navigation/Guard';
import { EmployeeDetailScreen } from '../../../features/employees/EmployeeDetailScreen';
// Exige employees.read mediante Guard antes de montar la pantalla de esta ruta.
export default function EmployeeRoute() {
  return (
    <Guard permission="employees.read">
      <EmployeeDetailScreen />
    </Guard>
  );
}
