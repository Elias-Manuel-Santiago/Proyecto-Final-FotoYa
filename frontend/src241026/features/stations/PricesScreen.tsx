/**
 * @file
 * Selecciona el contexto de puesto para administrar precios. Delega edición de tarifas a
 * StationPrices.
 */
import { useState } from 'react';
import { Text } from 'react-native';
import { Screen } from '../../components/ui/Screen';
import { Select } from '../../components/ui/Select';
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
  const [selected, setSelected] = useState(
    employee.stationId || stations[0]?.id || '',
  );
  const stationId =
    employee.roleId === 'manager' ? employee.stationId : selected;
  const station = stations.find((row) => row.id === stationId);
  return (
    <Screen title="Precios">
      {employee.roleId === 'owner' && (
        <Select
          label="Puesto"
          value={stationId}
          onChange={setSelected}
          options={stations.map((row) => ({ value: row.id, label: row.name }))}
        />
      )}
      {station ? (
        <>
          <Text style={styles.heading}>{station.name}</Text>
          <StationPrices key={station.id} stationId={station.id} />
        </>
      ) : (
        <Text style={styles.text}>No hay un puesto activo disponible.</Text>
      )}
    </Screen>
  );
}
