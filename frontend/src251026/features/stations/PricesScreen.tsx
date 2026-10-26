/**
 * @file
 * Selecciona el contexto de puesto para administrar precios. Delega edición de tarifas a
 * StationPrices.
 */
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Screen } from '../../components/ui/Screen';
import { FilterSection } from '../../components/filters/FilterSection';
import { ScopeColumns } from '../../components/filters/ScopeColumns';
import { graphicScopes } from '../../domain/graphics';
import { periodScopePatch, scopeColumns } from '../../domain/filter-scopes';
import { useTheme } from '../../components/ui/theme';
import { visibleStations } from '../../domain/metrics';
import { useWorkspace } from '../../providers/AppProvider';
import { StationPrices } from './StationPrices';

// Permite elegir un puesto visible para administrar sus tarifas.
export function PricesScreen() {
  const { styles } = useTheme();
  const { data, employee } = useWorkspace();
  const stations = visibleStations(data, employee).filter(
    (row) => row.active !== false,
  );
  const [selected, setSelected] = useState<string[]>(() => {
    const initial = employee.stationId || stations[0]?.id;
    return initial ? [`station:${initial}`] : [];
  });
  const selectedIds = periodScopePatch(stations, selected).stationIds;
  const filtered =
    employee.roleId === 'manager'
      ? stations.filter((station) => station.id === employee.stationId)
      : stations.filter(
          (station) =>
            selectedIds === undefined || selectedIds.includes(station.id),
        );
  return (
    <Screen title="Precios">
      {employee.roleId === 'owner' && (
        <FilterSection>
          <ScopeColumns
            columns={scopeColumns(graphicScopes(stations))}
            selected={selected}
            onChange={setSelected}
          />
        </FilterSection>
      )}
      {filtered.map((station) => (
        <View key={station.id} style={styles.stack}>
          <Text style={styles.heading}>{station.name}</Text>
          <StationPrices key={station.id} stationId={station.id} />
        </View>
      ))}
      {!filtered.length && (
        <Text style={styles.text}>No hay un puesto activo disponible.</Text>
      )}
    </Screen>
  );
}
