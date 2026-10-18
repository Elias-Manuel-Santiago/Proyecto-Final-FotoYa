import { Guard } from '../../components/navigation/Guard';
import { ReportsScreen } from '../../features/reports/ReportsScreen';
export default function ReportsRoute() {
  return (
    <Guard permission="reports.read">
      <ReportsScreen />
    </Guard>
  );
}
