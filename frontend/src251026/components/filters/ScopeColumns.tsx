import { ScrollView, Pressable, Text, View } from 'react-native';
import { useTheme } from '../ui/theme';

export interface ScopeColumn {
  title: string;
  options: { value: string; label: string }[];
}

export function ScopeCheckbox({
  label,
  checked,
  onPress,
}: {
  label: string;
  checked: boolean;
  onPress: () => void;
}) {
  const { colors, styles } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityLabel={label}
      accessibilityState={{ checked }}
      onPress={onPress}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        minHeight: 44,
        paddingVertical: 8,
      }}
    >
      <View
        style={{
          width: 20,
          height: 20,
          flexShrink: 0,
          borderRadius: 4,
          borderWidth: 2,
          borderColor: checked ? colors.primary : colors.muted,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: checked ? colors.lavender : colors.surface,
        }}
      >
        <Text style={{ color: colors.primary, fontWeight: '700' }}>
          {checked ? '✓' : ''}
        </Text>
      </View>
      <Text style={[styles.text, { flexShrink: 1 }]}>{label}</Text>
    </Pressable>
  );
}

export function ScopeColumns({
  columns,
  selected,
  onChange,
}: {
  columns: ScopeColumn[];
  selected: string[];
  onChange: (selected: string[]) => void;
}) {
  const { colors, styles } = useTheme();
  return (
    <ScrollView horizontal contentContainerStyle={{ flexGrow: 1 }}>
      <View style={{ flexDirection: 'row', flex: 1, minWidth: 420 }}>
        {columns.map((column) => (
          <View
            key={column.title}
            style={{
              flex: 1,
              minWidth: 140,
              paddingHorizontal: 8,
              borderLeftWidth: 1,
              borderColor: colors.border,
            }}
          >
            <Text accessibilityRole="header" style={styles.label}>
              {column.title}
            </Text>
            {column.options.map((option) => (
              <ScopeCheckbox
                key={option.value}
                label={option.label}
                checked={selected.includes(option.value)}
                onPress={() =>
                  onChange(
                    selected.includes(option.value)
                      ? selected.filter((id) => id !== option.value)
                      : [...selected, option.value],
                  )
                }
              />
            ))}
            {!column.options.length && (
              <Text style={styles.muted}>Sin opciones</Text>
            )}
          </View>
        ))}
      </View>
    </ScrollView>
  );
}
