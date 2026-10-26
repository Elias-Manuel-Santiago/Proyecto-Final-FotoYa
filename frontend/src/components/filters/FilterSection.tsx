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
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          minHeight: 44,
        }}
      >
        <View
          style={[styles.row, { flex: 1, minWidth: 0, flexWrap: 'nowrap' }]}
        >
          <Icon name="filtrar" />
          <View style={{ flex: 1, gap: 2 }}>
            <Text style={styles.label}>Filtros</Text>
            {!!summary && <Text style={styles.muted}>{summary}</Text>}
          </View>
        </View>
        <Text style={{ color: colors.primary, fontWeight: '600' }}>
          {open ? 'Cerrar' : 'Editar'}
        </Text>
      </Pressable>
      {open && (
        <View
          style={[
            styles.stack,
            { borderTopWidth: 1, borderColor: colors.border, paddingTop: 16 },
          ]}
        >
          {children}
        </View>
      )}
    </View>
  );
}
