/**
 * @file
 * Unifica botones, variantes y estado ocupado. Comparte interacción y accesibilidad entre
 * formularios y pantallas.
 */
import { ActivityIndicator, Pressable, Text } from 'react-native';
import { useTheme } from './theme';

interface Props {
  title: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
  secondary?: boolean;
  danger?: boolean;
}

// Unifica apariencia, accesibilidad y bloqueo mientras la acción está ocupada o deshabilitada.
export function Button({
  title,
  onPress,
  disabled,
  busy,
  secondary,
  danger,
}: Props) {
  const { colors } = useTheme();
  const foreground = danger
    ? colors.error
    : secondary
      ? colors.text
      : '#211c24';
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title}
      accessibilityState={{ disabled: disabled || busy, busy }}
      disabled={disabled || busy}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 48,
        maxWidth: '100%',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: danger
          ? colors.error
          : secondary
            ? colors.border
            : colors.brand,
        backgroundColor: secondary || danger ? colors.surface : colors.brand,
        opacity: disabled || busy ? 0.5 : pressed ? 0.75 : 1,
        flexDirection: 'row',
        gap: 8,
        alignItems: 'center',
        justifyContent: 'center',
      })}
    >
      {busy && <ActivityIndicator color={foreground} />}
      <Text
        style={{
          fontSize: 15,
          lineHeight: 22,
          fontWeight: '600',
          color: foreground,
          flexShrink: 1,
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
    </Pressable>
  );
}
