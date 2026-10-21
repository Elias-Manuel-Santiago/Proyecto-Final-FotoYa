/**
 * @file
 * Conecta la ruta del área de trabajo con EmployeesScreen. La lógica vive en features y las
 * restricciones de navegación se completan en layouts y guardas.
 */
import { Guard } from '../../../components/navigation/Guard';
import { EmployeesScreen } from '../../../features/employees/EmployeesScreen';
// Exige employees.read mediante Guard antes de montar la pantalla de esta ruta.
export default function EmployeesRoute() {
  return (
    <Guard permission="employees.read">
      <EmployeesScreen />
    </Guard>
  );
}
