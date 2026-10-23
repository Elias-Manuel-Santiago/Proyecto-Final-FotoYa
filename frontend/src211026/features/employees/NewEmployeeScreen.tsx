/**
 * @file
 * Coordina alta desde el formulario compartido. Guarda mediante el repositorio y actualiza
 * datos al confirmar.
 */
import { router } from 'expo-router';
import { Screen } from '../../components/ui/Screen';
import { EmployeeForm } from './components/EmployeeForm';

// Monta el formulario de alta y define la navegación al terminar el guardado.
export function NewEmployeeScreen() {
  return (
    <Screen title="Alta de usuario">
      <EmployeeForm onSaved={() => router.replace('/employees')} />
    </Screen>
  );
}
