/**
 * @file
 * Conecta la ruta del área de trabajo con MyAttendanceScreen. La lógica vive en features y las
 * restricciones de navegación se completan en layouts y guardas.
 */
import { Guard } from '../../components/navigation/Guard';
import { MyAttendanceScreen } from '../../features/attendance/MyAttendanceScreen';
// Exige attendance.self mediante Guard antes de montar la pantalla de esta ruta.
export default function MyAttendanceRoute() {
  return (
    <Guard permission="attendance.self">
      <MyAttendanceScreen />
    </Guard>
  );
}
