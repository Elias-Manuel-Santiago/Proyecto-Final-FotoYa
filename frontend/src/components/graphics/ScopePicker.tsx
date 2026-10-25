import { Text, View } from 'react-native';
import type { GraphicScope } from '../../domain/graphics';
import { scopeColumns } from '../../domain/filter-scopes';
import { ScopeCheckbox, ScopeColumns } from '../filters/ScopeColumns';
import { Button } from '../ui/Button';
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
  const { styles } = useTheme();
  return (
    <View style={styles.stack}>
      <Text style={styles.label}>Ciudades, eventos y puestos</Text>
      <Text style={styles.muted}>
        Cada opción seleccionada agrega una serie al gráfico.
      </Text>
      {scopes.some((scope) => scope.id === 'total') && (
        <ScopeCheckbox
          label="Total"
          checked={selected.includes('total')}
          onPress={() =>
            onChange(
              selected.includes('total')
                ? selected.filter((id) => id !== 'total')
                : [...selected, 'total'],
            )
          }
        />
      )}
      <ScopeColumns
        columns={scopeColumns(scopes)}
        selected={selected}
        onChange={onChange}
      />
      <Button
        secondary
        title="Limpiar selección de series"
        onPress={() => onChange([])}
      />
    </View>
  );
}
