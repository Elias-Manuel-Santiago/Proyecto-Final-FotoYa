import { useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import type { GraphicScope } from '../../domain/graphics';
import { Button } from '../ui/Button';
import { Field } from '../ui/Field';
import { useTheme } from '../ui/theme';

export function ScopePicker({
  scopes,
  selected,
  onChange,
}: {
  scopes: GraphicScope[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const { styles, colors } = useTheme();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Comparar ingresos y rendimiento</Text>
      <Text style={styles.muted}>
        Cada casilla agrega una serie independiente. El total incluye todos los
        puestos de tu alcance.
      </Text>
      <Text style={styles.text}>
        {selected.length
          ? scopes
              .filter((s) => selected.includes(s.id))
              .map((s) => s.label)
              .join(' · ')
          : 'Ninguna serie seleccionada'}
      </Text>
      <Button
        secondary
        title="Elegir total, ciudades, eventos y puestos"
        onPress={() => setOpen(true)}
      />
      <Modal
        visible={open}
        transparent
        animationType="fade"
        onRequestClose={() => setOpen(false)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: '#00000080',
            justifyContent: 'center',
            padding: 16,
          }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Cerrar selección de series"
            onPress={() => setOpen(false)}
            style={{ position: 'absolute', inset: 0 }}
          />
          <View
            accessibilityViewIsModal
            style={[
              styles.card,
              {
                width: '100%',
                maxWidth: 640,
                maxHeight: '85%',
                alignSelf: 'center',
              },
            ]}
          >
            <Text accessibilityRole="header" style={styles.heading}>
              Series del gráfico
            </Text>
            <Field
              label="Buscar ciudad, evento o puesto"
              value={query}
              onChangeText={setQuery}
            />
            <ScrollView
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: 4 }}
            >
              {scopes
                .filter((s) =>
                  s.label
                    .toLocaleLowerCase()
                    .includes(query.toLocaleLowerCase()),
                )
                .map((scope) => {
                  const checked = selected.includes(scope.id);
                  return (
                    <Pressable
                      key={scope.id}
                      accessibilityRole="checkbox"
                      accessibilityLabel={scope.label}
                      accessibilityState={{ checked }}
                      onPress={() =>
                        onChange(
                          checked
                            ? selected.filter((id) => id !== scope.id)
                            : [...selected, scope.id],
                        )
                      }
                      style={[
                        styles.row,
                        {
                          minHeight: 48,
                          padding: 12,
                          borderRadius: 10,
                          backgroundColor: checked
                            ? colors.lavender
                            : colors.surface,
                        },
                      ]}
                    >
                      <View
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 5,
                          borderWidth: 2,
                          borderColor: checked ? colors.primary : colors.muted,
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        <Text
                          style={{ color: colors.primary, fontWeight: '700' }}
                        >
                          {checked ? '✓' : ''}
                        </Text>
                      </View>
                      <Text style={[styles.text, { flex: 1 }]}>
                        {scope.label}
                      </Text>
                    </Pressable>
                  );
                })}
            </ScrollView>
            <View style={styles.row}>
              <Button
                secondary
                title="Limpiar selección"
                onPress={() => onChange([])}
              />
              <Button title="Listo" onPress={() => setOpen(false)} />
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}
