import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Select } from '../../components/ui/Select';
import { Feedback } from '../../components/ui/Feedback';
import { useTheme } from '../../components/ui/theme';
import type { Station } from '../../domain/models';
import { useAction } from '../../hooks/useAction';
import { useWorkspace } from '../../providers/AppProvider';

export function StationEditor({
  station,
  onClose,
}: {
  station: Station;
  onClose: () => void;
}) {
  const { data, repository, refresh } = useWorkspace();
  const { styles } = useTheme();
  const action = useAction();
  const [name, setName] = useState(station.name);
  const [cityId, setCityId] = useState(station.cityId ?? '');
  const [eventId, setEventId] = useState(station.eventId ?? '');
  const [assignments, setAssignments] = useState<Record<string, string>>({});
  const workers = data.employees.filter((row) =>
    ['manager', 'editor', 'cameraman', 'seller'].includes(row.roleId),
  );
  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Modificar {station.name}</Text>
      <Feedback error={action.error} success={action.success} />
      <Field
        label="Nombre del puesto"
        value={name}
        maxLength={150}
        editable={!action.busy}
        onChangeText={setName}
      />
      <Select
        label="Evento"
        value={eventId}
        disabled={action.busy}
        options={[
          { value: '', label: 'Sin evento' },
          ...(data.events ?? []).map((row) => ({
            value: row.id,
            label: `${row.name} · ${data.cities?.find((city) => city.id === row.cityId)?.name ?? ''}`,
          })),
        ]}
        onChange={(value) => {
          setEventId(value);
          const event = data.events?.find((row) => row.id === value);
          if (event) setCityId(event.cityId);
        }}
      />
      <Select
        label="Ciudad"
        value={cityId}
        disabled={action.busy || !!eventId}
        options={(data.cities ?? []).map((row) => ({
          value: row.id,
          label: row.name,
        }))}
        onChange={setCityId}
      />
      <Text style={styles.muted}>
        El evento determina la ciudad del puesto. Para quitar un empleado, elegí
        su nuevo puesto; cada empleado tiene una sola asignación.
      </Text>
      {workers.map((row) => (
        <Select
          key={row.id}
          label={`${row.firstName} ${row.lastName}${row.active ? '' : ' (inactivo)'}`}
          value={assignments[row.id] ?? row.stationId}
          disabled={action.busy}
          options={data.stations
            .filter(
              (value) =>
                value.id === row.stationId ||
                (value.active !== false &&
                  (row.stationId === station.id || value.id === station.id)),
            )
            .map((value) => ({ value: value.id, label: value.name }))}
          onChange={(value) =>
            setAssignments((current) => ({ ...current, [row.id]: value }))
          }
        />
      ))}
      <Button
        title="Guardar cambios"
        busy={action.busy}
        onPress={() => {
          void action.run(async () => {
            if (!name.trim() || !cityId)
              throw new Error('Completá nombre y ciudad.');
            await repository.updateStation({
              stationId: station.id,
              name,
              cityId,
              eventId: eventId || null,
              employeeStations: workers
                .filter(
                  (row) =>
                    assignments[row.id] &&
                    assignments[row.id] !== row.stationId,
                )
                .map((row) => ({
                  employeeId: row.id,
                  stationId: assignments[row.id],
                })),
            });
            await refresh();
            onClose();
          });
        }}
      />
      <Button
        title="Cancelar"
        secondary
        disabled={action.busy}
        onPress={onClose}
      />
    </View>
  );
}
