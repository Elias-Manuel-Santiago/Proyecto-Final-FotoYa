import { Guard } from '../../../components/navigation/Guard';
import { SalesScreen } from '../../../features/sales/SalesScreen';
export default function SalesRoute() {
  return (
    <Guard permission="sales.read">
      <SalesScreen />
    </Guard>
  );
}
