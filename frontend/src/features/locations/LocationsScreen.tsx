import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, Pressable } from 'react-native';
import { FilterSection } from '../../components/filters/FilterSection';
import { EmptyState } from '../../components/ui/Feedback';
import { Field } from '../../components/ui/Field';
import { Icon } from '../../components/ui/Icon';
import { ResponsiveGrid } from '../../components/ui/ResponsiveGrid';
import { Screen } from '../../components/ui/Screen';
import { Select } from '../../components/ui/Select';
import { useTheme } from '../../components/ui/theme';
import { locationDirectory } from '../../domain/location-directory';
import { useWorkspace } from '../../providers/AppProvider';

export function LocationsScreen({ kind }: { kind: 'city' | 'event' }) {
  const { city = '' } = useLocalSearchParams<{ city?: string }>();
  return (
    <LocationDirectory key={`${kind}:${city}`} kind={kind} initialCity={city} />
  );
}

function LocationDirectory({
  kind,
  initialCity,
}: {
  kind: 'city' | 'event';
  initialCity: string;
}) {
  const { data } = useWorkspace();
  const { styles } = useTheme();
  const [search, setSearch] = useState('');
  const [city, setCity] = useState(initialCity);
  const cities = locationDirectory(data.stations, 'city');
  const rows = locationDirectory(
    data.stations,
    kind,
    kind === 'event' ? city : '',
  ).filter((row) =>
    `${row.name} ${row.cityName}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );
  return (
    <Screen title={kind === 'city' ? 'Ciudades' : 'Eventos'}>
      <FilterSection>
        <Field
          label={kind === 'city' ? 'Buscar ciudad' : 'Buscar evento'}
          value={search}
          onChangeText={setSearch}
        />
        {kind === 'event' && (
          <Select
            label="Ciudad"
            value={city}
            onChange={setCity}
            options={[
              { value: '', label: 'Todas' },
              ...cities.map((row) => ({ value: row.id, label: row.name })),
            ]}
          />
        )}
      </FilterSection>
      {!rows.length && <EmptyState />}
      <ResponsiveGrid>
        {rows.map((row) => (
          <Link
            key={JSON.stringify([row.city, row.id])}
            asChild
            href={
              kind === 'city'
                ? { pathname: '/events', params: { city: row.id } }
                : {
                    pathname: '/stations',
                    params: { city: row.city, event: row.id },
                  }
            }
          >
            <Pressable
              accessibilityRole="link"
              accessibilityLabel={`${row.name}: ${kind === 'city' ? 'ver eventos' : 'ver puestos'}`}
              style={styles.card}
            >
              <Icon name={kind === 'city' ? 'ciudades' : 'eventos'} size={36} />
              <Text style={styles.heading}>{row.name}</Text>
              {kind === 'event' && (
                <Text style={styles.text}>{row.cityName}</Text>
              )}
              <Text style={styles.muted}>
                {row.stations.length} puestos ·{' '}
                {row.stations.filter((s) => s.active !== false).length} activos
              </Text>
              {kind === 'city' && (
                <Text style={styles.muted}>
                  {locationDirectory(row.stations, 'event').length} eventos
                </Text>
              )}
              <Text style={styles.text}>
                {kind === 'city' ? 'Ver eventos' : 'Ver puestos'}
              </Text>
            </Pressable>
          </Link>
        ))}
      </ResponsiveGrid>
    </Screen>
  );
}
