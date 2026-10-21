import { router } from 'expo-router';
import { Screen } from '../../components/ui/Screen';
import { EmployeeForm } from './components/EmployeeForm';

export function NewEmployeeScreen() {
  return (
    <Screen title="Alta de usuario">
      <EmployeeForm onSaved={() => router.replace('/employees')} />
    </Screen>
  );
}
