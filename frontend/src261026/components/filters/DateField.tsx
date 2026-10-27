import { useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { DateTimePicker } from '@expo/ui/community/datetime-picker';
import { Button } from '../ui/Button';
import { useTheme } from '../ui/theme';
import { displayDate } from '../../domain/dates';
import { dateFromCalendar, dateToCalendar } from '../../domain/filter-dates';

export interface DateFieldProps {
  label: string;
  value: string;
  onChange: (date: string) => void;
}

export function DateField({ label, value, onChange }: DateFieldProps) {
  const { colors, styles } = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <Button
        secondary
        title={value ? displayDate(value) : 'Elegir fecha'}
        onPress={() => setOpen(!open)}
      />
      {open && (
        <>
          <DateTimePicker
            value={dateToCalendar(value)}
            mode="date"
            display={Platform.OS === 'ios' ? 'inline' : 'default'}
            presentation={Platform.OS === 'android' ? 'dialog' : 'inline'}
            accentColor={colors.primary}
            locale="es-AR"
            positiveButton={{ label: 'Aceptar' }}
            negativeButton={{ label: 'Cancelar' }}
            onDismiss={() => setOpen(false)}
            onValueChange={(_event, date) => {
              onChange(dateFromCalendar(date));
              if (Platform.OS === 'android') setOpen(false);
            }}
          />
          {Platform.OS === 'ios' && (
            <Button secondary title="Listo" onPress={() => setOpen(false)} />
          )}
        </>
      )}
    </View>
  );
}
