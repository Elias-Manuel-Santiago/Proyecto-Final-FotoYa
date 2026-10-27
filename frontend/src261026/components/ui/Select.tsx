import { useState } from 'react';
import {
  Modal,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from './theme';
import { Icon } from './Icon';
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
  const { colors, styles } = useTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const matches = options.filter((option) =>
    option.label.toLocaleLowerCase().includes(query.toLocaleLowerCase()),
  );
  return (
    <View style={{ gap: 6 }}>
      <Text style={styles.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${options.find((o) => o.value === value)?.label ?? 'Seleccionar'}`}
        accessibilityState={{ expanded: open, disabled }}
        disabled={disabled}
        onPress={() => {
          setQuery('');
          setOpen(true);
        }}
        style={[
          styles.input,
          {
            flexDirection: 'row',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
      >
        <Text style={[styles.text, { flexShrink: 1 }]}>
          {options.find((o) => o.value === value)?.label ?? 'Seleccionar'}
        </Text>
        <View style={{ transform: [{ rotate: '90deg' }] }}>
          <Icon name="flecha-der" size={20} color={colors.muted} />
        </View>
      </Pressable>
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={{
            flex: 1,
            backgroundColor: '#00000080',
            justifyContent: 'center',
            paddingTop: insets.top + 24,
            paddingBottom: insets.bottom + 24,
            paddingLeft: insets.left + 16,
            paddingRight: insets.right + 16,
          }}
        >
          <Pressable
            accessibilityLabel="Cerrar selector"
            onPress={() => setOpen(false)}
            style={{ position: 'absolute', inset: 0 }}
          />
          <View
            accessibilityViewIsModal
            style={[
              styles.card,
              {
                width: '100%',
                maxWidth: 480,
                maxHeight: '80%',
                alignSelf: 'center',
              },
            ]}
          >
            <View style={[styles.row, { justifyContent: 'space-between' }]}>
              <Text accessibilityRole="header" style={styles.heading}>
                {label}
              </Text>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel="Cerrar selector"
                onPress={() => setOpen(false)}
                style={{ padding: 12, minHeight: 44 }}
              >
                <Text style={styles.text}>Cerrar</Text>
              </Pressable>
            </View>
            <TextInput
              accessibilityLabel={`Buscar ${label.toLowerCase()}`}
              placeholder="Buscar opción…"
              placeholderTextColor={colors.muted}
              value={query}
              onChangeText={setQuery}
              style={styles.input}
              autoFocus
            />
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: 4 }}
            >
              {matches.map((option) => (
                <Pressable
                  key={option.value}
                  accessibilityRole="radio"
                  accessibilityLabel={option.label}
                  accessibilityState={{ checked: value === option.value }}
                  onPress={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  style={{
                    padding: 14,
                    minHeight: 48,
                    borderRadius: 10,
                    backgroundColor:
                      value === option.value ? colors.lavender : colors.surface,
                  }}
                >
                  <Text style={styles.text}>
                    {value === option.value ? '✓  ' : ''}
                    {option.label}
                  </Text>
                </Pressable>
              ))}
              {!matches.length && (
                <Text style={styles.muted}>No hay coincidencias.</Text>
              )}
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
