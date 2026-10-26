/**
 * @file
 * Conecta la ruta del área de trabajo con NewSaleScreen. La lógica vive en features y las
 * restricciones de navegación se completan en layouts y guardas.
 */
import { Guard } from '../../../components/navigation/Guard';
import { NewSaleScreen } from '../../../features/sales/NewSaleScreen';
// Exige sales.create mediante Guard antes de montar la pantalla de esta ruta.
export default function NewSaleRoute() {
  return (
    <Guard permission="sales.create">
      <NewSaleScreen />
    </Guard>
  );
}
