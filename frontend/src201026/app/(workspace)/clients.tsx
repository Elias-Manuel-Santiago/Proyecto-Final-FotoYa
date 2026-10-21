import { Guard } from '../../components/navigation/Guard';
import { ClientsScreen } from '../../features/clients/ClientsScreen';

export default function ClientsRoute() {
  return (
    <Guard permission="clients.read">
      <ClientsScreen />
    </Guard>
  );
}
