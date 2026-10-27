import { ResponsiveGrid } from '../../components/ui/ResponsiveGrid';
/**
 * @file
 * Presenta puestos y acciones de alta, baja y reactivación. Conserva acceso a historial y
 * tarifas según permiso.
 */
import { useState } from 'react';
import { useLocalSearchParams } from 'expo-router';
import { can } from '../../domain/permissions';
import { Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { ConfirmAction } from '../../components/ui/ConfirmAction';
import { Field } from '../../components/ui/Field';
import { EmptyState, Feedback } from '../../components/ui/Feedback';
import { Screen } from '../../components/ui/Screen';
import { Select } from '../../components/ui/Select';
import { FilterSection } from '../../components/filters/FilterSection';
import { ScopeColumns } from '../../components/filters/ScopeColumns';
import { graphicScopes } from '../../domain/graphics';
import { periodScopePatch, scopeColumns } from '../../domain/filter-scopes';
import { useTheme } from '../../components/ui/theme';
import { useAction } from '../../hooks/useAction';
import { useWorkspace } from '../../providers/AppProvider';
import { StationPrices } from './StationPrices';
import { StationEditor } from './StationEditor';
// Filtra puestos y coordina alta, disponibilidad y consulta de tarifas.
export function StationsScreen() {
  const { city = '', event = '' } = useLocalSearchParams<{
    city?: string;
    event?: string;
  }>();
  return (
    <StationDirectory
      key={JSON.stringify([city, event])}
      city={city}
      event={event}
    />
  );
}

function StationDirectory({ city, event }: { city: string; event: string }) {
  const { styles } = useTheme();
  const { data, employee, repository, refresh } = useWorkspace();
  const manage = can(employee, 'stations.manage');
  const [eventId, setEventId] = useState('');
  const events = data.events ?? [];
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [scopeIds, setScopeIds] = useState<string[]>(() => [
    ...(city ? [`city:${city}`] : []),
    ...(event ? [`event:${event}`] : []),
  ]);
  const selectedIds = periodScopePatch(data.stations, scopeIds).stationIds;
  const [pricing, setPricing] = useState('');
  const [editing, setEditing] = useState('');
  const action = useAction();
  const rows = data.stations.filter(
    (row) =>
      (selectedIds === undefined || selectedIds.includes(row.id)) &&
      (status === 'all' || (status === 'active') === (row.active !== false)) &&
      `${row.name} ${row.city} ${row.event}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  // Solicita el cambio de estado y refresca la lista al confirmarse.
  const changeAvailability = (stationId: string, active: boolean) =>
    action.run(
      async () => {
        await repository.setStationActive(stationId, active);
        await refresh();
      },
      active
        ? 'Puesto reactivado.'
        : 'Puesto dado de baja. Se conserva su historial.',
    );
  return (
    <Screen title="Puestos">
      <Feedback error={action.error} success={action.success} />
      {manage && (
        <Button
          title={creating ? 'Cancelar alta' : 'Alta de puesto'}
          secondary={creating}
          disabled={action.busy}
          onPress={() => {
            setCreating(!creating);
            action.clear();
          }}
        />
      )}
      {manage && creating && (
        <View style={styles.card}>
          <Text style={styles.heading}>Nuevo puesto</Text>
          <Select
            label="Evento"
            value={eventId}
            disabled={action.busy || !events.length}
            options={events.map((row) => ({
              value: row.id,
              label: `${row.name} · ${data.cities?.find((city) => city.id === row.cityId)?.name ?? ''}`,
            }))}
            onChange={setEventId}
          />
          <Text style={styles.muted}>
            {events.length
              ? 'El puesto toma el nombre y la ciudad del evento seleccionado.'
              : 'Primero creá un evento para poder dar de alta un puesto.'}
          </Text>
          <Button
            title="Guardar puesto"
            busy={action.busy}
            disabled={!events.some((row) => row.id === eventId)}
            onPress={() => {
              void action.run(async () => {
                if (!events.some((row) => row.id === eventId))
                  throw new Error('Seleccioná un evento existente.');
                await repository.createStation({ eventId });
                setEventId('');
                setCreating(false);
                await refresh();
              }, 'Puesto creado.');
            }}
          />
        </View>
      )}
      <FilterSection>
        <ScopeColumns
          columns={scopeColumns(graphicScopes(data.stations))}
          selected={scopeIds}
          onChange={setScopeIds}
        />
        <Field
          label="Buscar puesto, ciudad o evento"
          value={search}
          onChangeText={setSearch}
        />
        <Select
          label="Estado"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: 'Todos' },
            { value: 'active', label: 'Activos' },
            { value: 'inactive', label: 'Inactivos' },
          ]}
        />
      </FilterSection>
      {!rows.length && <EmptyState />}
      <ResponsiveGrid>
        {rows.map((station) => (
          <View key={station.id} style={styles.card}>
            <Text style={styles.heading}>{station.name}</Text>
            <Text style={styles.text}>{station.city}</Text>
            <Text style={styles.text}>{station.event}</Text>
            <Text style={styles.muted}>
              {station.active === false ? 'Inactivo' : 'Activo'}
            </Text>
            {manage && (
              <Button
                title="Modificar puesto"
                secondary
                disabled={action.busy}
                onPress={() =>
                  setEditing(editing === station.id ? '' : station.id)
                }
              />
            )}
            {manage && editing === station.id && (
              <StationEditor station={station} onClose={() => setEditing('')} />
            )}
            {can(employee, 'prices.manage') && station.active !== false && (
              <Button
                title="Precios del puesto"
                secondary
                onPress={() =>
                  setPricing(pricing === station.id ? '' : station.id)
                }
              />
            )}
            {can(employee, 'prices.manage') &&
              pricing === station.id &&
              station.active !== false && (
                <StationPrices stationId={station.id} />
              )}
            {manage &&
              (station.active === false ? (
                <Button
                  title={`Reactivar ${station.name}`}
                  busy={action.busy}
                  onPress={() => {
                    void changeAvailability(station.id, true);
                  }}
                />
              ) : (
                <ConfirmAction
                  title={`Dar de baja ${station.name}`}
                  question={`¿Dar de baja ${station.name}? Se conservarán los usuarios asignados, fotos, ventas y horarios. No se admitirán nuevas cargas de fotos ni nuevas asignaciones a este puesto hasta reactivarlo.`}
                  busy={action.busy}
                  onConfirm={() => changeAvailability(station.id, false)}
                />
              ))}
          </View>
        ))}
      </ResponsiveGrid>
    </Screen>
  );
}
