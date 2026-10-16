import { Pressable, Text, View } from 'react-native';
import { colors, styles } from './theme';

export interface Option {
  value: string;
  label: string;
}

export function Select({
  label,
  value,
  options,
  onChange,
  disabled,
}: {
  label: string;
  value: string;
  options: Option[];
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {options.map((option) => (
          <Pressable
            key={option.value}
            accessibilityRole="radio"
            accessibilityLabel={`${label}: ${option.label}`}
            accessibilityState={{ checked: value === option.value, disabled }}
            disabled={disabled}
            onPress={() => onChange(option.value)}
            style={{
              padding: 12,
              minHeight: 44,
              borderRadius: 4,
              borderWidth: value === option.value ? 2 : 1,
              borderColor:
                value === option.value ? colors.primary : colors.border,
              backgroundColor:
                value === option.value ? colors.accent : colors.surface,
              opacity: disabled ? 0.5 : 1,
            }}
          >
            <Text style={styles.text}>{option.label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}
