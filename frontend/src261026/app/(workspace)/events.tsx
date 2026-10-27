import { Guard } from '../../components/navigation/Guard';
import { LocationsScreen } from '../../features/locations/LocationsScreen';

export default function Route() {
  return (
    <Guard permission="catalog.read" roles={['owner', 'secretary']}>
      <LocationsScreen kind="event" />
    </Guard>
  );
}
