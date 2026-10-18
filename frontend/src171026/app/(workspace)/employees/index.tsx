import { Guard } from '../../../components/navigation/Guard';
import { EmployeesScreen } from '../../../features/employees/EmployeesScreen';
export default function EmployeesRoute() {
  return (
    <Guard permission="employees.read">
      <EmployeesScreen />
    </Guard>
  );
}
