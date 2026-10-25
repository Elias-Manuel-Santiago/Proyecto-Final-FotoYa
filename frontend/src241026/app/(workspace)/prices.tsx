/**
 * @file
 * Conecta la ruta del área de trabajo con PricesScreen. La lógica vive en features y las
 * restricciones de navegación se completan en layouts y guardas.
 */
import { Guard } from '../../components/navigation/Guard';
import { PricesScreen } from '../../features/stations/PricesScreen';

// Exige prices.manage mediante Guard antes de montar la pantalla de esta ruta.
export default function PricesRoute() {
  return (
    <Guard permission="prices.manage">
      <PricesScreen />
    </Guard>
  );
}
