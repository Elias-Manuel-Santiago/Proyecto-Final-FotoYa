import { Guard } from '../../components/navigation/Guard';
import { PhotosScreen } from '../../features/photos/PhotosScreen';
export default function PhotosRoute() {
  return (
    <Guard permission="photos.read">
      <PhotosScreen />
    </Guard>
  );
}
