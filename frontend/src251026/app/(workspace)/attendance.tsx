/**
 * @file
 * Conecta la ruta del área de trabajo con AttendanceScreen. La lógica vive en features y las
 * restricciones de navegación se completan en layouts y guardas.
 */
import { Guard } from '../../components/navigation/Guard';
import { AttendanceScreen } from '../../features/attendance/AttendanceScreen';
// Exige attendance.read mediante Guard antes de montar la pantalla de esta ruta.
export default function AttendanceRoute() {
  return (
    <Guard permission="attendance.read">
      <AttendanceScreen />
    </Guard>
  );
}
