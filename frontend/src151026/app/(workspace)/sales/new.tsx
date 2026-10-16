import { Guard } from '../../../components/navigation/Guard';
import { NewSaleScreen } from '../../../features/sales/NewSaleScreen';
export default function NewSaleRoute() {
  return (
    <Guard permission="sales.create">
      <NewSaleScreen />
    </Guard>
  );
}
