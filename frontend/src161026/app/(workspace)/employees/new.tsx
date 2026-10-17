import { Guard } from '../../../components/navigation/Guard';
import { NewEmployeeScreen } from '../../../features/employees/NewEmployeeScreen';
export default function NewEmployeeRoute() {
  return (
    <Guard permission="employees.manage">
      <NewEmployeeScreen />
    </Guard>
  );
}
