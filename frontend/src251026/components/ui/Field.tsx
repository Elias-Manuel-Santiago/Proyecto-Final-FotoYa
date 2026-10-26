/**
 * @file
 * Compone etiqueta, entrada y error reutilizables. Propaga propiedades de edición y
 * accesibilidad del formulario.
 */
import type { ReactNode } from 'react';
import { Text, TextInput, View, type TextInputProps } from 'react-native';
import { useTheme } from './theme';

// Integra etiqueta y entrada de texto con el estilo compartido del formulario.
export function Field({
  label,
  rightAccessory,
  error,
  ...props
}: TextInputProps & {
  label: string;
  rightAccessory?: ReactNode;
  error?: string;
}) {
  const { colors, styles } = useTheme();
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <View>
        <TextInput
          accessibilityLabel={label}
          placeholderTextColor={colors.muted}
          {...props}
          accessibilityHint={error || props.accessibilityHint}
          style={[
            styles.input,
            props.style,
            rightAccessory ? { paddingRight: 52 } : undefined,
            error ? { borderColor: colors.error, borderWidth: 2 } : undefined,
          ]}
        />
        {rightAccessory && (
          <View style={{ position: 'absolute', right: 1, top: 1, bottom: 1 }}>
            {rightAccessory}
          </View>
        )}
      </View>
      {!!error && (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="polite"
          style={styles.error}
        >
          {error}
        </Text>
      )}
    </View>
  );
}
