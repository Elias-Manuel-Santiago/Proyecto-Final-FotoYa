import { Guard } from '../../components/navigation/Guard';
import { PricesScreen } from '../../features/stations/PricesScreen';

export default function PricesRoute() {
  return (
    <Guard permission="prices.manage">
      <PricesScreen />
    </Guard>
  );
}
