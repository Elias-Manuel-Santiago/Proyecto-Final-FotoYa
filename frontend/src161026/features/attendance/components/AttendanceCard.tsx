import { Text, View } from 'react-native';
import { styles } from '../../../components/ui/theme';
import { displayDate, displayInstant, duration } from '../../../domain/dates';
import type { Attendance } from '../../../domain/models';

export function AttendanceCard({
  record,
  employeeName,
  stationName,
}: {
  record: Attendance;
  employeeName?: string;
  stationName: string;
}) {
  return (
    <View style={styles.card}>
      {employeeName && <Text style={styles.heading}>{employeeName}</Text>}
      <Text style={styles.text}>
        {stationName} · Día de entrada: {displayDate(record.date)}
      </Text>
      <Text style={styles.text}>Entrada: {displayInstant(record.checkIn)}</Text>
      <Text style={styles.text}>
        Salida:{' '}
        {record.checkOut ? displayInstant(record.checkOut) : 'Sin registrar'}
      </Text>
      <Text style={styles.muted}>
        {duration(record.checkIn, record.checkOut)}
      </Text>
    </View>
  );
}
