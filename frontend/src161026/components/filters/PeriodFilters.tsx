import { View } from 'react-native';
import { Field } from '../ui/Field';
import { Select } from '../ui/Select';
import { styles } from '../ui/theme';
import type { Period, Station } from '../../domain/models';

export function PeriodFilters({
  period,
  stations,
  onChange,
  extended = false,
}: {
  period: Period;
  stations: Station[];
  onChange: (value: Partial<Period>) => void;
  extended?: boolean;
}) {
  return (
    <View style={styles.card}>
      <Field
        label="Desde (AAAA-MM-DD)"
        value={period.from}
        onChangeText={(from) => onChange({ from })}
        autoCapitalize="none"
      />
      <Field
        label="Hasta (AAAA-MM-DD)"
        value={period.to}
        onChangeText={(to) => onChange({ to })}
        autoCapitalize="none"
      />
      {stations.length > 1 && (
        <Select
          label="Puesto"
          value={period.stationId}
          options={[
            { value: '', label: 'Todos' },
            ...stations.map((row) => ({ value: row.id, label: row.name })),
          ]}
          onChange={(stationId) => onChange({ stationId })}
        />
      )}
      {extended && (
        <>
          <Select
            label="Ciudad"
            value={period.city ?? ''}
            options={[
              { value: '', label: 'Todas' },
              ...Array.from(
                new Map(
                  stations.map((row) => [row.cityId ?? row.city, row.city]),
                ).entries(),
              ).map(([value, label]) => ({ value, label })),
            ]}
            onChange={(city) => onChange({ city, stationId: '' })}
          />
          <Select
            label="Evento"
            value={period.event ?? ''}
            options={[
              { value: '', label: 'Todos' },
              ...Array.from(
                new Map(
                  stations
                    .filter((row) => row.event)
                    .map((row) => [row.eventId ?? row.event, row.event]),
                ).entries(),
              ).map(([value, label]) => ({ value, label })),
            ]}
            onChange={(event) => onChange({ event, stationId: '' })}
          />
        </>
      )}
    </View>
  );
}
