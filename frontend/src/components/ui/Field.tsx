import type { ReactNode } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';
import { colors, styles } from './theme';

export function Field({
  label,
  rightAccessory,
  ...props
}: TextInputProps & { label: string; rightAccessory?: ReactNode }) {
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <View>
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.muted}
          {...props}
          style={[
            styles.input,
            props.style,
            rightAccessory ? { paddingRight: 52 } : undefined,
          ]}
        />
        {rightAccessory && (
          <View style={{ position: 'absolute', right: 1, top: 1, bottom: 1 }}>
            {rightAccessory}
          </View>
        )}
      </View>
    </View>
  );
}
