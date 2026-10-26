/**
 * @file
 * Presenta perfil, jornada y sesiones propias. Coordina contraseña, revocación y actualización
 * del estado de acceso.
 */
import { useState } from 'react';
import { Switch, Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { PasswordField } from '../../components/ui/PasswordField';
import { Icon } from '../../components/ui/Icon';
import { Feedback } from '../../components/ui/Feedback';
import { Screen } from '../../components/ui/Screen';
import { useTheme } from '../../components/ui/theme';
import { fullName } from '../../domain/format';
import { canWork, roleLabels } from '../../domain/permissions';
import { useAction } from '../../hooks/useAction';
import { useWorkspace } from '../../providers/AppProvider';

// Gestiona datos propios, sesiones, contraseña y actualización del estado de trabajo.
export function ProfileScreen() {
  const { styles, colors, mode, toggle } = useTheme();
  const { data, employee, logout, repository, refresh } = useWorkspace();
  const action = useAction();
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  return (
    <Screen
      compact
      title="Mi usuario"
      refreshing={action.busy}
      onRefresh={() => {
        void action.run(refresh);
      }}
    >
      {!canWork(employee) && (
        <Text style={styles.muted}>
          No estás trabajando. Registrá tu check-in en la pantalla de Check-in
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
        {!['owner', 'client'].includes(employee.roleId) && (
          <Text style={styles.text}>
            Puesto asignado:{' '}
            {data.stations.find((row) => row.id === employee.stationId)?.name ??
              employee.stationName ??
              (employee.stationId
                ? `Puesto ${employee.stationId}`
                : 'Sin puesto asignado')}
          </Text>
        )}
      </View>
      <View
        style={[
          styles.card,
          {
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          },
        ]}
      >
        <View style={{ flex: 1, gap: 4 }}>
          <Text style={styles.heading}>Apariencia</Text>
          <Text style={styles.muted}>Tema oscuro</Text>
        </View>
        <Icon
          name={mode === 'dark' ? 'tema-oscuro' : 'tema-claro'}
          color={colors.primary}
        />
        <Switch
          accessibilityLabel="Tema oscuro"
          value={mode === 'dark'}
          onValueChange={toggle}
          trackColor={{ false: colors.border, true: colors.primary }}
        />
      </View>
      <Feedback error={action.error} success={action.success} />
      <View style={styles.card}>
        <Text style={styles.heading}>Cambiar contraseña</Text>
        <PasswordField
          label="Contraseña actual"
          value={currentPassword}
          onChangeText={setCurrentPassword}
          autoCapitalize="none"
          editable={!action.busy}
        />
        <PasswordField
          label="Nueva contraseña"
          value={password}
          onChangeText={setPassword}
          autoCapitalize="none"
          maxLength={128}
          editable={!action.busy}
        />
        <Text style={styles.muted}>Usá entre 12 y 128 caracteres.</Text>
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
      <Button
        title="Cerrar sesión"
        danger
        busy={action.busy}
        onPress={() => {
          void action.run(logout);
        }}
      />
    </Screen>
  );
}
