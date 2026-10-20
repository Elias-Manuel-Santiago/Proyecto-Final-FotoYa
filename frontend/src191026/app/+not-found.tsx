import { Link } from 'expo-router';
import { Screen } from '../components/ui/Screen';
export default function NotFound() {
  return (
    <Screen title="Vista no encontrada">
      <Link href="/">Volver al inicio</Link>
    </Screen>
  );
}
