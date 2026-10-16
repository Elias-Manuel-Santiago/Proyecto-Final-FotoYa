import { Guard } from '../../components/navigation/Guard';
import { AttendanceScreen } from '../../features/attendance/AttendanceScreen';
export default function AttendanceRoute() {
  return (
    <Guard permission="attendance.read">
      <AttendanceScreen />
    </Guard>
  );
}
