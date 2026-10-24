/**
 * @file
 * Presenta entrada, salida y duración. Distingue turnos abiertos y muestra instantes en
 * horario argentino.
 */
import { Text, View } from 'react-native';
import { useTheme } from '../../../components/ui/theme';
import { displayDate, displayInstant, duration } from '../../../domain/dates';
import type { Attendance } from '../../../domain/models';

// Presenta el turno con empleado, puesto y horarios convertidos para su lectura.
export function AttendanceCard({
  record,
  employeeName,
  stationName,
}: {
  record: Attendance;
  employeeName?: string;
  stationName: string;
}) {
  const { styles } = useTheme();
  return (
    <View style={styles.card}>
      {employeeName && <Text style={styles.heading}>{employeeName}</Text>}
      <Text style={styles.text}>
        {stationName} · Día de entrada: {displayDate(record.date)}
      </Text>
      <Text style={styles.text}>Entrada: {displayInstant(record.checkIn)}</Text>
      <Text style={styles.text}>
        Salida:{' '}
        {record.checkOut
          ? displayInstant(record.checkOut)
          : record.closedAt
            ? 'No hizo check-out'
            : 'Sin registrar'}
      </Text>
      <Text style={styles.muted}>
        {duration(record.checkIn, record.checkOut, record.closedAt)}
      </Text>
    </View>
  );
}
