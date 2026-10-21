/**
 * @file
 * Presenta recuperación para direcciones sin pantalla. Mantiene el tratamiento de navegación
 * desconocida dentro del router.
 */
import { Link } from 'expo-router';
import { Screen } from '../components/ui/Screen';
// Ofrece una salida de navegación cuando la dirección no corresponde a una ruta.
export default function NotFound() {
  return (
    <Screen title="Vista no encontrada">
      <Link href="/">Volver al inicio</Link>
    </Screen>
  );
}
