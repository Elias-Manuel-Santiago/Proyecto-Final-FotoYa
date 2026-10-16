import { Guard } from '../../components/navigation/Guard';
import { StationsScreen } from '../../features/stations/StationsScreen';

export default function StationsRoute() {
  return (
    <Guard permission="stations.manage">
      <StationsScreen />
    </Guard>
  );
}
