/**
 * @file
 * Presenta puestos y acciones de alta, baja y reactivación. Conserva acceso a historial y
 * tarifas según permiso.
 */
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { ConfirmAction } from '../../components/ui/ConfirmAction';
import { Field } from '../../components/ui/Field';
import { EmptyState, Feedback } from '../../components/ui/Feedback';
import { Screen } from '../../components/ui/Screen';
import { Select } from '../../components/ui/Select';
import { styles } from '../../components/ui/theme';
import { useAction } from '../../hooks/useAction';
import { useWorkspace } from '../../providers/AppProvider';
import { StationPrices } from './StationPrices';

const empty = { name: '', address: '', city: '', event: '' };

// Filtra puestos y coordina alta, disponibilidad y consulta de tarifas.
export function StationsScreen() {
  const { data, repository, refresh } = useWorkspace();
  const [input, setInput] = useState(empty);
  const [creating, setCreating] = useState(false);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [pricing, setPricing] = useState('');
  const action = useAction();
  const rows = data.stations.filter(
    (row) =>
      (status === 'all' || (status === 'active') === (row.active !== false)) &&
      `${row.name} ${row.address} ${row.city} ${row.event}`
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
      <Button
        title={creating ? 'Cancelar alta' : 'Alta de puesto'}
        secondary={creating}
        disabled={action.busy}
        onPress={() => {
          setCreating(!creating);
          action.clear();
        }}
      />
      {creating && (
        <View style={styles.card}>
          <Text style={styles.heading}>Nuevo puesto</Text>
          {(['name', 'address', 'city', 'event'] as const).map((key) => (
            <Field
              key={key}
              label={
                {
                  name: 'Nombre del puesto',
                  address: 'Dirección',
                  city: 'Ciudad',
                  event: 'Evento (opcional)',
                }[key]
              }
              value={input[key]}
              maxLength={key === 'address' ? 255 : key === 'city' ? 120 : 150}
              editable={!action.busy}
              onChangeText={(value) =>
                setInput((current) => ({ ...current, [key]: value }))
              }
            />
          ))}
          <Text style={styles.muted}>
            Si la ciudad o el evento ya existen, se reutilizan.
          </Text>
          <Button
            title="Guardar puesto"
            busy={action.busy}
            onPress={() => {
              void action.run(async () => {
                if (
                  !input.name.trim() ||
                  !input.address.trim() ||
                  !input.city.trim()
                )
                  throw new Error('Completá nombre, dirección y ciudad.');
                await repository.createStation(input);
                setInput(empty);
                setCreating(false);
                await refresh();
              }, 'Puesto creado.');
            }}
          />
        </View>
      )}
      <Field
        label="Buscar puesto, dirección, ciudad o evento"
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
      {!rows.length && <EmptyState />}
      {rows.map((station) => (
        <View key={station.id} style={styles.card}>
          <Text style={styles.heading}>{station.name}</Text>
          <Text style={styles.text}>
            {station.address} · {station.city}
          </Text>
          {!!station.event && (
            <Text style={styles.text}>Evento: {station.event}</Text>
          )}
          <Text style={styles.muted}>
            {station.active === false ? 'Inactivo' : 'Activo'}
          </Text>
          {station.active !== false && (
            <Button
              title="Precios del puesto"
              secondary
              onPress={() =>
                setPricing(pricing === station.id ? '' : station.id)
              }
            />
          )}
          {pricing === station.id && station.active !== false && (
            <StationPrices stationId={station.id} />
          )}
          {station.active === false ? (
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
          )}
        </View>
      ))}
    </Screen>
  );
}
