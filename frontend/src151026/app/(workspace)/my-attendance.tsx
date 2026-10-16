import { Guard } from '../../components/navigation/Guard';
import { MyAttendanceScreen } from '../../features/attendance/MyAttendanceScreen';
export default function MyAttendanceRoute() {
  return (
    <Guard permission="attendance.self">
      <MyAttendanceScreen />
    </Guard>
  );
}
