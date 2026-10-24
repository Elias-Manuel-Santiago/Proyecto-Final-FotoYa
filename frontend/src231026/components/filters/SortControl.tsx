import { Pressable, Text } from 'react-native';
import { Icon } from '../ui/Icon';
import { useTheme } from '../ui/theme';
export function SortControl({
  ascending,
  onChange,
}: {
  ascending: boolean;
  onChange: (value: boolean) => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Ordenar: ${ascending ? 'más antiguos primero' : 'más recientes primero'}. Cambiar orden`}
      onPress={() => onChange(!ascending)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
        alignSelf: 'flex-start',
        padding: 12,
        minHeight: 44,
        borderWidth: 1,
        borderColor: colors.border,
        backgroundColor: colors.surface,
        borderRadius: 12,
      }}
    >
      <Icon name="ordenar" size={20} />
      <Text style={{ color: colors.text }}>
        {ascending ? 'Más antiguos primero' : 'Más recientes primero'}
      </Text>
    </Pressable>
  );
}
