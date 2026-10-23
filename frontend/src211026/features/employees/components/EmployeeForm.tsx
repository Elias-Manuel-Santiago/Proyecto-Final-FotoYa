/**
 * @file
 * Mantiene campos de alta/edición y asignación de rol/puesto. Valida y entrega la entrada a la
 * pantalla controladora.
 */
import { useState } from 'react';
import { View } from 'react-native';
import { Button } from '../../../components/ui/Button';
import { Field } from '../../../components/ui/Field';
import { Feedback } from '../../../components/ui/Feedback';
import { Select } from '../../../components/ui/Select';
import { styles } from '../../../components/ui/theme';
import type { Employee, EmployeeInput, RoleId } from '../../../domain/models';
import { visibleStations } from '../../../domain/metrics';
import { assignableRoles, roleLabels } from '../../../domain/permissions';
import { useAction } from '../../../hooks/useAction';
import { useWorkspace } from '../../../providers/AppProvider';

// Mantiene datos y asignación para reutilizar el flujo en alta y edición.
export function EmployeeForm({
  existing,
  onSaved,
}: {
  existing?: Employee;
  onSaved?: () => void;
}) {
  const { data, employee, repository, refresh, logout } = useWorkspace();
  const [input, setInput] = useState<EmployeeInput>(() => ({
    id: existing?.id,
    firstName: existing?.firstName ?? '',
    lastName: existing?.lastName ?? '',
    email: existing?.email ?? '',
    dni: existing?.dni ?? '',
    roleId: existing?.roleId ?? 'photographer',
    stationId: existing?.stationId ?? employee.stationId,
  }));
  const action = useAction();
  // Aplica cambios parciales y limpia el resultado de la operación anterior.
  const update = (patch: Partial<EmployeeInput>) => {
    setInput((current) => ({ ...current, ...patch }));
    action.clear();
  };

  // Guarda y refresca; si se editó la propia cuenta, cierra su sesión revocada.
  function save() {
    void action.run(async () => {
      await repository.saveEmployee(input);
      if (input.id === employee.id) {
        await logout().catch(() => undefined);
      } else await refresh();
      onSaved?.();
    }, 'Usuario guardado.');
  }

  return (
    <View style={styles.stack}>
      <Field
        label="Nombre"
        value={input.firstName}
        onChangeText={(firstName) => update({ firstName })}
        editable={!action.busy}
      />
      <Field
        label="Apellido"
        value={input.lastName}
        onChangeText={(lastName) => update({ lastName })}
        editable={!action.busy}
      />
      <Field
        label="Email"
        value={input.email}
        onChangeText={(email) => update({ email })}
        keyboardType="email-address"
        autoCapitalize="none"
        editable={!action.busy}
      />
      <Field
        label="DNI"
        value={input.dni}
        onChangeText={(dni) => update({ dni })}
        keyboardType="number-pad"
        maxLength={20}
        editable={!action.busy}
      />
      {!existing && (
        <Field
          label="Contraseña inicial (12 a 128 caracteres)"
          value={input.password ?? ''}
          onChangeText={(password) => update({ password })}
          secureTextEntry
          autoCapitalize="none"
          editable={!action.busy}
          maxLength={128}
        />
      )}
      <Select
        label="Rol"
        value={input.roleId}
        options={(
          data.roles?.map((row) => row.roleId) ?? assignableRoles(employee)
        ).map((value) => ({
          value,
          label: roleLabels[value],
        }))}
        onChange={(value) => update({ roleId: value as RoleId })}
        disabled={action.busy || existing?.id === employee.id}
      />
      <Select
        label="Puesto asignado"
        value={input.stationId}
        options={[
          ...(['owner', 'secretary', 'client'].includes(input.roleId) &&
          employee.roleId === 'owner'
            ? [{ value: '', label: 'Sin puesto asignado' }]
            : []),
          ...visibleStations(data, employee)
            .filter(
              (station) =>
                station.active !== false || station.id === existing?.stationId,
            )
            .map((station) => ({
              value: station.id,
              label: station.name,
            })),
        ]}
        onChange={(stationId) => update({ stationId })}
        disabled={action.busy || existing?.id === employee.id}
      />
      <Feedback error={action.error} success={action.success} />
      <Button title="Guardar usuario" onPress={save} busy={action.busy} />
    </View>
  );
}
