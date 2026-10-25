/**
 * @file
 * Conecta la ruta del área de trabajo con NewEmployeeScreen. La lógica vive en features y las
 * restricciones de navegación se completan en layouts y guardas.
 */
import { Guard } from '../../../components/navigation/Guard';
import { NewEmployeeScreen } from '../../../features/employees/NewEmployeeScreen';
// Exige employees.manage mediante Guard antes de montar la pantalla de esta ruta.
export default function NewEmployeeRoute() {
  return (
    <Guard permission="employees.manage">
      <NewEmployeeScreen />
    </Guard>
  );
}
