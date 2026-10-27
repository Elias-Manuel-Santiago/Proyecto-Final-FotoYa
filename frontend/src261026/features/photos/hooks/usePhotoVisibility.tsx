import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Button } from '../../../components/ui/Button';
import { Feedback } from '../../../components/ui/Feedback';
import { useTheme } from '../../../components/ui/theme';
import { useWorkspace } from '../../../providers/AppProvider';
import { can } from '../../../domain/permissions';
import { useAction } from '../../../hooks/useAction';

export function usePhotoVisibility(
  scope: string,
  reload: () => void,
  enabled = true,
) {
  const { repository, employee } = useWorkspace();
  enabled =
    enabled &&
    ['seller', 'manager'].includes(employee.roleId) &&
    can(employee, 'sales.create');
  const { styles, colors } = useTheme();
  const action = useAction();
  const [showHidden, setShowHidden] = useState(false);
  const [selection, setSelection] = useState<{ key: string; ids: string[] }>({
    key: '',
    ids: [],
  });
  const key = JSON.stringify([scope, showHidden]);
  const selected = selection.key === key ? selection.ids : [];
  const controls = enabled && (
    <View style={{ gap: 8 }}>
      <View style={styles.row}>
        <Button
          title={showHidden ? 'Volver a fotos visibles' : 'Ver fotos ocultas'}
          secondary
          disabled={action.busy}
          onPress={() => {
            setShowHidden(!showHidden);
            action.clear();
          }}
        />
        {!!selected.length && (
          <>
            <Button
              title={`${showHidden ? 'Restaurar' : 'Ocultar'} ${selected.length} fotos`}
              busy={action.busy}
              onPress={() => {
                void action.run(
                  async () => {
                    await repository.setPhotoVisibility(selected, !showHidden);
                    setSelection({ key, ids: [] });
                    reload();
                  },
                  showHidden
                    ? 'Fotos restauradas para todo el puesto.'
                    : 'Fotos ocultas para todo el puesto. Se conservan los archivos y el historial.',
                );
              }}
            />
            <Button
              title="Cancelar selección"
              secondary
              disabled={action.busy}
              onPress={() => setSelection({ key, ids: [] })}
            />
          </>
        )}
      </View>
      <Text style={styles.muted}>
        Seleccioná fotos para{' '}
        {showHidden
          ? 'volver a mostrarlas'
          : 'quitarlas de la lista sin borrarlas'}
        . El cambio se comparte con todo el puesto.
      </Text>
      <Feedback error={action.error} success={action.success} />
    </View>
  );
  const selectionControl = (id: string, name: string, sold = false) =>
    enabled && (
      <Pressable
        accessibilityRole="checkbox"
        accessibilityLabel={`Seleccionar ${name}`}
        accessibilityState={{
          checked: selected.includes(id),
          disabled: action.busy,
        }}
        disabled={
          action.busy ||
          (showHidden && sold) ||
          (!selected.includes(id) && selected.length >= 100)
        }
        onPress={() =>
          setSelection({
            key,
            ids: selected.includes(id)
              ? selected.filter((value) => value !== id)
              : [...selected, id],
          })
        }
        style={{
          minHeight: 44,
          paddingHorizontal: 8,
          justifyContent: 'center',
          borderRadius: 8,
          backgroundColor: selected.includes(id)
            ? colors.brand
            : colors.surface,
        }}
      >
        <Text
          style={[styles.text, selected.includes(id) && { color: '#211c24' }]}
        >
          {showHidden && sold
            ? 'Vendida · oculta'
            : selected.includes(id)
              ? '☑ Seleccionada'
              : '☐ Seleccionar'}
        </Text>
      </Pressable>
    );
  return { enabled, showHidden, controls, selectionControl, busy: action.busy };
}
