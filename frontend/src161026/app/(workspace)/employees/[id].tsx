import { Guard } from '../../../components/navigation/Guard';
import { EmployeeDetailScreen } from '../../../features/employees/EmployeeDetailScreen';
export default function EmployeeRoute() {
  return (
    <Guard permission="employees.read">
      <EmployeeDetailScreen />
    </Guard>
  );
}
