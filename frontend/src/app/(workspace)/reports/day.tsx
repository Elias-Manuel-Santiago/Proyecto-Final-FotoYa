import { Guard } from '../../../components/navigation/Guard';
import { DayReportScreen } from '../../../features/reports/DayReportScreen';

export default function DayReportRoute() {
  return (
    <Guard permission="reports.read">
      <DayReportScreen />
    </Guard>
  );
}
