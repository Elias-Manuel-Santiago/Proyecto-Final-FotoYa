import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Feedback } from '../../components/ui/Feedback';
import { Screen } from '../../components/ui/Screen';
import { styles } from '../../components/ui/theme';
import { displayInstant } from '../../domain/dates';
import { fullName } from '../../domain/format';
import { roleLabels } from '../../domain/permissions';
import { useAction } from '../../hooks/useAction';
import { useWorkspace } from '../../providers/AppProvider';

interface Session {
  id: string;
  created_at: string;
  expires_at: string;
  revoked_at: string | null;
}
export function ProfileScreen() {
  const { data, employee, logout, repository } = useWorkspace();
  const action = useAction();
  const [sessions, setSessions] = useState<Session[]>([]);
  const [currentPassword, setCurrentPassword] = useState('');
  const [password, setPassword] = useState('');
  useEffect(() => {
    void repository.api
      .all<Session>('auth/sessions/query')
      .then(setSessions)
      .catch(() => undefined);
  }, [repository]);
  return (
    <Screen title="Mi usuario">
      <View style={styles.card}>
        <Text style={styles.heading}>{fullName(employee)}</Text>
        <Text style={styles.text}>ID de usuario: {employee.id}</Text>
        <Text style={styles.text}>{roleLabels[employee.roleId]}</Text>
        <Text style={styles.text}>Email: {employee.email}</Text>
        <Text style={styles.text}>DNI: {employee.dni}</Text>
        <Text style={styles.text}>
          Puesto asignado:{' '}
          {data.stations.find((row) => row.id === employee.stationId)?.name ??
            'Sin puesto asignado'}
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
      <Text style={styles.heading}>Mis sesiones</Text>
      <Button
        title="Actualizar sesiones"
        secondary
        busy={action.busy}
        onPress={() => {
          void action.run(async () =>
            setSessions(
              await repository.api.all<Session>('auth/sessions/query'),
            ),
          );
        }}
      />
      {sessions.map((session) => (
        <View key={session.id} style={styles.card}>
          <Text style={styles.text}>
            Sesión {session.id} · {displayInstant(session.created_at)}
          </Text>
          <Text style={styles.muted}>
            Vence: {displayInstant(session.expires_at)}
          </Text>
          {session.revoked_at ? (
            <Text style={styles.muted}>Revocada</Text>
          ) : (
            <Button
              title={`Revocar sesión ${session.id}`}
              secondary
              busy={action.busy}
              onPress={() => {
                void action.run(async () => {
                  await repository.api.post('auth/sessions/revoke', {
                    sessionId: String(session.id),
                  });
                  setSessions(
                    await repository.api.all<Session>('auth/sessions/query'),
                  );
                });
              }}
            />
          )}
        </View>
      ))}
    </Screen>
  );
}
