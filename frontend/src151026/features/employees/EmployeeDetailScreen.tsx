import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { ConfirmAction } from '../../components/ui/ConfirmAction';
import { Feedback } from '../../components/ui/Feedback';
import { Screen } from '../../components/ui/Screen';
import { styles } from '../../components/ui/theme';
import { fullName } from '../../domain/format';
import {
  assignableRoles,
  can,
  hasStationAccess,
  roleLabels,
} from '../../domain/permissions';
import { useAction } from '../../hooks/useAction';
import { useWorkspace } from '../../providers/AppProvider';
import { EmployeeForm } from './components/EmployeeForm';

export function EmployeeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data, employee, repository, refresh } = useWorkspace();
  const [editing, setEditing] = useState(false);
  const action = useAction();
  const target = data.employees.find(
    (row) => row.id === id && hasStationAccess(employee, row.stationId),
  );
  if (!target)
    return (
      <Screen title="Empleado">
        <Text style={styles.text}>Empleado no disponible.</Text>
      </Screen>
    );
  const manageable =
    can(employee, 'employees.manage') &&
    assignableRoles(employee).includes(target.roleId);
  const station = data.stations.find((row) => row.id === target.stationId);

  async function toggleActive() {
    await action.run(async () => {
      await repository.setEmployeeActive(
        employee.id,
        target!.id,
        !target!.active,
      );
      await refresh();
    }, 'Estado actualizado.');
  }

  return (
    <Screen title={fullName(target)}>
      <View style={styles.card}>
        <Text style={styles.text}>Rol: {roleLabels[target.roleId]}</Text>
        <Text style={styles.text}>
          Puesto: {station?.name ?? 'Sin puesto asignado'}
        </Text>
        <Text style={styles.text}>Email: {target.email}</Text>
        <Text style={styles.text}>DNI: {target.dni}</Text>
        <Text style={styles.text}>
          Estado: {target.active ? 'Activo' : 'Inactivo'}
        </Text>
      </View>
      {target.roleId !== 'client' && can(employee, 'attendance.read') && (
        <Link
          href={{ pathname: '/attendance', params: { employeeId: target.id } }}
          style={styles.card}
        >
          Consultar horarios
        </Link>
      )}
      <Feedback error={action.error} success={action.success} />
      {manageable && (
        <>
          <Button
            title={editing ? 'Cerrar edición' : 'Editar empleado'}
            secondary
            disabled={action.busy}
            onPress={() => setEditing((value) => !value)}
          />
          {editing && (
            <EmployeeForm existing={target} onSaved={() => setEditing(false)} />
          )}
          {target.id !== employee.id && (
            <ConfirmAction
              title={target.active ? 'Dar de baja' : 'Reactivar empleado'}
              question={
                target.active
                  ? '¿Dar de baja al empleado? Se conservarán sus ventas y horarios.'
                  : '¿Reactivar al empleado?'
              }
              onConfirm={toggleActive}
              busy={action.busy}
            />
          )}
        </>
      )}
    </Screen>
  );
}
