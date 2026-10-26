import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Icon } from '../ui/Icon';
import { useTheme } from '../ui/theme';

export function FilterSection({
  children,
  summary,
  onOpen,
  open: controlledOpen,
  onOpenChange,
}: {
  children: ReactNode;
  summary?: string;
  onOpen?: () => void;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}) {
  const { colors, styles } = useTheme();
  const [localOpen, setLocalOpen] = useState(false);
  const open = controlledOpen ?? localOpen;
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={open ? 'Cerrar filtros' : 'Abrir filtros'}
        accessibilityState={{ expanded: open }}
        onPress={() => {
          if (!open) onOpen?.();
          setLocalOpen(!open);
          onOpenChange?.(!open);
        }}
        style={[styles.row, { minHeight: 44, justifyContent: 'space-between' }]}
      >
        <View style={styles.row}>
          <Icon name="filtrar" />
          <Text style={styles.label}>Filtros</Text>
        </View>
        {!!summary && (
          <Text style={[styles.muted, { flexShrink: 1 }]}>{summary}</Text>
        )}
        <Text style={{ color: colors.primary, fontWeight: '600' }}>
          {open ? 'Cerrar' : 'Editar'}
        </Text>
      </Pressable>
      {open && children}
    </View>
  );
}
