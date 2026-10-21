/**
 * @file
 * Presenta perfil, jornada y sesiones propias. Coordina contraseña, revocación y actualización
 * del estado de acceso.
 */
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Feedback } from '../../components/ui/Feedback';
import { Screen } from '../../components/ui/Screen';
import { styles } from '../../components/ui/theme';
import { fullName } from '../../domain/format';
import { canWork, roleLabels } from '../../domain/permissions';
import { useAction } from '../../hooks/useAction';
import { useWorkspace } from '../../providers/AppProvider';

// Gestiona datos propios, sesiones, contraseña y actualización del estado de trabajo.
export function ProfileScreen() {
  const { data, employee, logout, repository, refresh } = useWorkspace();
  const action = useAction();
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  return (
    <Screen
      title="Mi usuario"
      refreshing={action.busy}
      onRefresh={() => {
        void action.run(refresh);
      }}
    >
      {!canWork(employee) && (
        <Text style={styles.muted}>
          No estás trabajando. Registrá tu check-in en la pantalla del encargado
          de tu puesto para habilitar tus tareas. Deslizá hacia abajo para
          actualizar esta pantalla después de marcar.
        </Text>
      )}
      <View style={styles.card}>
        <Text style={styles.heading}>{fullName(employee)}</Text>
        <Text style={styles.text}>ID de usuario: {employee.id}</Text>
        <Text style={styles.text}>{roleLabels[employee.roleId]}</Text>
        <Text style={styles.text}>Email: {employee.email}</Text>
        <Text style={styles.text}>DNI: {employee.dni}</Text>
        <Text style={styles.text}>
          Puesto asignado:{' '}
          {data.stations.find((row) => row.id === employee.stationId)?.name ??
            employee.stationName ??
            (employee.stationId
              ? `Puesto ${employee.stationId}`
              : 'Sin puesto asignado')}
        </Text>
      </View>
      <Feedback error={action.error} success={action.success} />
      <Button
        title="Cerrar sesión"
        secondary
        busy={action.busy}
        onPress={() => {
          void action.run(logout);
        }}
      />
      <View style={styles.card}>
        <Text style={styles.heading}>Cambiar contraseña</Text>
        <Field
          label="Contraseña actual"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          secureTextEntry
          autoCapitalize="none"
          editable={!action.busy}
        />
        <Field
          label="Nueva contraseña (12 a 128 caracteres)"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          maxLength={128}
          editable={!action.busy}
        />
        <Text style={styles.muted}>
          El cambio cierra todas tus sesiones. Después, ingresá con la nueva
          contraseña.
        </Text>
        <Button
          title="Guardar contraseña"
          busy={action.busy}
          disabled={!currentPassword || password.length < 12}
          onPress={() => {
            void action.run(async () => {
              await repository.api.post('auth/password/change', {
                currentPassword,
                password,
              });
              await logout().catch(() => undefined);
            });
          }}
        />
      </View>
    </Screen>
  );
}
