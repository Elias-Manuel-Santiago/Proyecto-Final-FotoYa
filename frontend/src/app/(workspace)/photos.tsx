/**
 * @file
 * Conecta la ruta del área de trabajo con PhotosScreen. La lógica vive en features y las
 * restricciones de navegación se completan en layouts y guardas.
 */
import { Guard } from '../../components/navigation/Guard';
import { PhotosScreen } from '../../features/photos/PhotosScreen';
// Exige photos.read mediante Guard antes de montar la pantalla de esta ruta.
export default function PhotosRoute() {
  return (
    <Guard permission="photos.read">
      <PhotosScreen />
    </Guard>
  );
}
