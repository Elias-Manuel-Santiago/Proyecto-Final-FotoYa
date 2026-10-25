import { Text, View } from 'react-native';
import { useTheme } from '../ui/theme';
import { validDate } from '../../domain/dates';
import type { DateFieldProps } from './DateField';

export function DateField({ label, value, onChange }: DateFieldProps) {
  const { colors, styles } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <input
        type="date"
        aria-label={label}
        value={value}
        onClick={(event) => event.currentTarget.showPicker?.()}
        onKeyDown={(event) => {
          if (event.key === 'Tab' || event.key === 'Escape') return;
          event.preventDefault();
          if (event.key === 'Enter' || event.key === ' ')
            event.currentTarget.showPicker?.();
        }}
        onChange={(event) => {
          if (validDate(event.target.value)) onChange(event.target.value);
        }}
        style={{
          boxSizing: 'border-box',
          width: '100%',
          minHeight: 48,
          padding: 12,
          borderRadius: 12,
          border: `1px solid ${colors.border}`,
          backgroundColor: colors.surface,
          color: colors.text,
          fontFamily: 'inherit',
          fontSize: 16,
          cursor: 'pointer',
        }}
      />
    </View>
  );
}
