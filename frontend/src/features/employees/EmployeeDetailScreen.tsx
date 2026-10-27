/**
 * @file
 * Carga un usuario para edición y cambio de disponibilidad. Coordina confirmaciones y efectos
 * sobre la sesión propia.
 */
import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { ConfirmAction } from '../../components/ui/ConfirmAction';
import { Feedback } from '../../components/ui/Feedback';
import { Screen } from '../../components/ui/Screen';
import { useTheme } from '../../components/ui/theme';
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

// Resuelve el usuario de la ruta y presenta edición, disponibilidad y acceso a asistencia.
export function EmployeeDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  return <EmployeeDetails key={id} />;
}

function EmployeeDetails() {
  const { styles } = useTheme();
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

  // Cambia disponibilidad con la acción compartida y refresca los datos confirmados.
  async function toggleActive() {
    await action.run(async () => {
      await repository.setEmployeeActive(target!.id, !target!.active);
      await refresh();
    }, 'Estado actualizado.');
  }

  return (
    <Screen title={fullName(target)}>
      <View style={styles.card}>
        <Text style={styles.text}>Rol: {roleLabels[target.roleId]}</Text>
        {!['owner', 'client'].includes(target.roleId) && (
          <Text style={styles.text}>
            Puesto: {station?.name ?? 'Sin puesto asignado'}
          </Text>
        )}
        <Text style={styles.text}>Email: {target.email}</Text>
        <Text style={styles.text}>DNI: {target.dni}</Text>
        <Text style={styles.text}>
          Estado: {target.active ? 'Activo' : 'Inactivo'}
        </Text>
      </View>
      {!['client', 'secretary'].includes(target.roleId) &&
        can(employee, 'attendance.read') && (
          <Link
            href={{
              pathname: '/attendance',
              params: { employeeId: target.id },
            }}
            style={[styles.card, styles.text]}
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
            <EmployeeForm
              existing={target}
              onSaved={() => {
                setEditing(false);
              }}
            />
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
