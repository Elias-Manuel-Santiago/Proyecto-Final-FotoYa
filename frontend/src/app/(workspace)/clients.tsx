/**
 * @file
 * Conecta la ruta del área de trabajo con ClientsScreen. La lógica vive en features y las
 * restricciones de navegación se completan en layouts y guardas.
 */
import { Guard } from '../../components/navigation/Guard';
import { ClientsScreen } from '../../features/clients/ClientsScreen';

// Exige clients.read mediante Guard antes de montar la pantalla de esta ruta.
export default function ClientsRoute() {
  return (
    <Guard permission="clients.read">
      <ClientsScreen />
    </Guard>
  );
}
