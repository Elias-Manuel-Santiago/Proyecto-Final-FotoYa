import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { FilterSection } from '../../components/filters/FilterSection';
import { ScopeCheckbox } from '../../components/filters/ScopeColumns';
import { EmptyState, Feedback } from '../../components/ui/Feedback';
import { Button } from '../../components/ui/Button';
import { ConfirmAction } from '../../components/ui/ConfirmAction';
import { Field } from '../../components/ui/Field';
import { Icon } from '../../components/ui/Icon';
import { ResponsiveGrid } from '../../components/ui/ResponsiveGrid';
import { Screen } from '../../components/ui/Screen';
import { Select } from '../../components/ui/Select';
import { useTheme } from '../../components/ui/theme';
import { can } from '../../domain/permissions';
import { useAction } from '../../hooks/useAction';
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
  const { data, employee, repository, refresh } = useWorkspace();
  const { styles } = useTheme();
  const action = useAction();
  const manage = can(employee, 'stations.manage');
  const [search, setSearch] = useState('');
  const [city, setCity] = useState(initialCity);
  const [editing, setEditing] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [eventCity, setEventCity] = useState(initialCity);
  const [stationIds, setStationIds] = useState<string[]>([]);
  const [eventCities, setEventCities] = useState<Record<string, string>>({});
  const cities = data.cities ?? [];
  const events = data.events ?? [];
  const cityOptions = cities.map((row) => ({ value: row.id, label: row.name }));
  const rows = (
    kind === 'city'
      ? cities
      : events.filter((row) => !city || row.cityId === city)
  ).filter((row) =>
    row.name.toLowerCase().includes(search.trim().toLowerCase()),
  );
  const start = (id: string) => {
    setEditing(id);
    setName(
      (kind === 'city' ? cities : events).find((row) => row.id === id)?.name ??
        '',
    );
    setEventCity(events.find((row) => row.id === id)?.cityId ?? initialCity);
    setStationIds(
      data.stations.filter((row) => row.eventId === id).map((row) => row.id),
    );
    setEventCities(
      Object.fromEntries(events.map((row) => [row.id, row.cityId])),
    );
    action.clear();
  };
  return (
    <Screen title={kind === 'city' ? 'Ciudades' : 'Eventos'}>
      <Feedback error={action.error} success={action.success} />
      {manage && (
        <Button
          title={kind === 'city' ? 'Crear ciudad' : 'Crear evento'}
          disabled={action.busy}
          onPress={() => start('')}
        />
      )}
      {manage && editing !== null && (
        <View style={styles.card}>
          <Text style={styles.heading}>
            {editing ? 'Modificar' : 'Crear'}{' '}
            {kind === 'city' ? 'ciudad' : 'evento'}
          </Text>
          <Field
            label="Nombre"
            value={name}
            maxLength={kind === 'city' ? 120 : 150}
            editable={!action.busy}
            onChangeText={setName}
          />
          {kind === 'event' ? (
            <>
              <Select
                label="Ciudad del evento"
                value={eventCity}
                disabled={action.busy}
                onChange={setEventCity}
                options={[
                  { value: '', label: 'Seleccionar ciudad' },
                  ...cityOptions,
                ]}
              />
              <Text style={styles.muted}>
                Los puestos seleccionados pasarán a este evento y su ciudad. Al
                desmarcarlos conservarán su ciudad y quedarán sin evento.
              </Text>
              {data.stations.map((row) => (
                <ScopeCheckbox
                  key={row.id}
                  label={`${row.name} · ${row.city}${row.event ? ` · ${row.event}` : ''}`}
                  checked={stationIds.includes(row.id)}
                  onPress={() => {
                    if (!action.busy)
                      setStationIds((current) =>
                        current.includes(row.id)
                          ? current.filter((id) => id !== row.id)
                          : [...current, row.id],
                      );
                  }}
                />
              ))}
            </>
          ) : (
            <>
              <Text style={styles.muted}>
                Elegí la ciudad de cada evento. Sus puestos se trasladarán junto
                con él.
              </Text>
              {events.map((row) => (
                <Select
                  key={row.id}
                  label={row.name}
                  disabled={action.busy}
                  value={eventCities[row.id] ?? row.cityId}
                  options={[
                    ...cityOptions,
                    ...(!editing
                      ? [{ value: '__new__', label: 'Esta nueva ciudad' }]
                      : []),
                  ]}
                  onChange={(value) =>
                    setEventCities((current) => ({
                      ...current,
                      [row.id]: value,
                    }))
                  }
                />
              ))}
            </>
          )}
          <Button
            title="Guardar"
            busy={action.busy}
            onPress={() => {
              void action.run(async () => {
                if (!name.trim()) throw new Error('Completá el nombre.');
                if (kind === 'city')
                  await repository.saveCity({
                    ...(editing ? { id: editing } : {}),
                    name,
                    eventCities: events
                      .filter(
                        (row) =>
                          eventCities[row.id] &&
                          eventCities[row.id] !== row.cityId,
                      )
                      .map((row) => ({
                        eventId: row.id,
                        cityId:
                          eventCities[row.id] === '__new__'
                            ? null
                            : eventCities[row.id],
                      })),
                  });
                else {
                  if (!eventCity) throw new Error('Seleccioná una ciudad.');
                  await repository.saveEvent({
                    ...(editing ? { id: editing } : {}),
                    name,
                    cityId: eventCity,
                    stationIds,
                  });
                }
                await refresh();
                setEditing(null);
              }, 'Cambios guardados.');
            }}
          />
          <Button
            title="Cancelar"
            secondary
            disabled={action.busy}
            onPress={() => setEditing(null)}
          />
        </View>
      )}
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
            options={[{ value: '', label: 'Todas' }, ...cityOptions]}
          />
        )}
      </FilterSection>
      {!rows.length && <EmptyState />}
      <ResponsiveGrid>
        {rows.map((row) => {
          const associated = data.stations.filter((station) =>
            kind === 'city'
              ? station.cityId === row.id
              : station.eventId === row.id,
          );
          const cityId =
            kind === 'event'
              ? (events.find((event) => event.id === row.id)?.cityId ?? '')
              : row.id;
          const eventCount = events.filter(
            (event) => event.cityId === row.id,
          ).length;
          const blocked =
            associated.length > 0 || (kind === 'city' && eventCount > 0);
          return (
            <View key={row.id} style={styles.card}>
              <Icon name={kind === 'city' ? 'ciudades' : 'eventos'} size={36} />
              <Text style={styles.heading}>{row.name}</Text>
              {kind === 'event' && (
                <Text style={styles.text}>
                  {cities.find((value) => value.id === cityId)?.name}
                </Text>
              )}
              <Text style={styles.muted}>
                {associated.length} puestos ·{' '}
                {
                  associated.filter((station) => station.active !== false)
                    .length
                }{' '}
                activos
              </Text>
              {kind === 'city' && (
                <Text style={styles.muted}>{eventCount} eventos</Text>
              )}
              <Link
                href={
                  kind === 'city'
                    ? { pathname: '/events', params: { city: row.id } }
                    : {
                        pathname: '/stations',
                        params: { city: cityId, event: row.id },
                      }
                }
                style={styles.text}
              >
                {kind === 'city' ? 'Ver eventos' : 'Ver puestos'}
              </Link>
              {manage && (
                <>
                  <Button
                    title="Modificar"
                    secondary
                    disabled={action.busy}
                    onPress={() => start(row.id)}
                  />
                  {blocked ? (
                    <Text style={styles.muted}>
                      {kind === 'city'
                        ? 'Para eliminar, trasladá primero sus eventos y puestos.'
                        : 'Para eliminar, quitá primero sus puestos, incluidos los inactivos.'}
                    </Text>
                  ) : (
                    <ConfirmAction
                      title={`Eliminar ${row.name}`}
                      question={`¿Eliminar ${row.name}?`}
                      busy={action.busy}
                      onConfirm={() =>
                        action.run(async () => {
                          await repository.deleteLocation(kind, row.id);
                          await refresh();
                          if (editing === row.id) setEditing(null);
                        }, 'Registro eliminado.')
                      }
                    />
                  )}
                </>
              )}
            </View>
          );
        })}
      </ResponsiveGrid>
    </Screen>
  );
}
