/**
 * @file
 * Presenta empleados y pide credenciales para marcar en kiosco. Refresca asistencia y exige
 * contraseña de la cuenta para configurar puesto o cerrar sesión.
 */
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { EmptyState, Feedback } from '../../components/ui/Feedback';
import { Screen } from '../../components/ui/Screen';
import { useTheme } from '../../components/ui/theme';
import type { CheckInEmployee } from '../../domain/models';
import { errorMessage, fullName } from '../../domain/format';
import { useAction } from '../../hooks/useAction';
import { useWorkspace } from '../../providers/AppProvider';
import { CheckInOptions } from './components/CheckInOptions';

// Selecciona empleado y confirma su entrada o salida con sus propias credenciales.
export function CheckInScreen() {
  const { employee } = useWorkspace();
  return <CheckInStationScreen key={employee.stationId} />;
}

function CheckInStationScreen() {
  const { styles } = useTheme();
  const { repository, employee } = useWorkspace();
  const [employees, setEmployees] = useState<CheckInEmployee[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<CheckInEmployee | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const action = useAction();
  const reload = useCallback(async () => {
    if (!employee.stationId) {
      setEmployees([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      setEmployees(await repository.checkInEmployees());
      setError('');
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setLoading(false);
    }
  }, [repository, employee.stationId]);
  useEffect(() => {
    const initial = setTimeout(() => {
      void reload();
    }, 0);
    const timer = setInterval(() => {
      void reload();
    }, 60000);
    return () => {
      clearTimeout(initial);
      clearInterval(timer);
    };
  }, [reload]);
  // Limpia selección y credenciales para comenzar una nueva marcación.
  const reset = () => {
    setSelected(null);
    setEmail('');
    setPassword('');
    action.clear();
  };
  return (
    <SafeAreaView style={{ flex: 1 }} edges={['top']}>
      <Screen
        title="Check-in del puesto"
        refreshing={loading}
        refreshEnabled={!selected && !action.busy}
        onRefresh={() => {
          void reload();
        }}
      >
        <Text style={styles.muted}>
          {employee.stationId
            ? `${employee.stationName ?? 'Puesto asignado'} · Seleccioná tu nombre para registrar tu entrada o salida.`
            : 'Seleccioná un puesto desde el botón de opciones para comenzar.'}
        </Text>
        <Feedback error={error || action.error} success={action.success} />
        {selected ? (
          <View style={styles.card}>
            <Text style={styles.heading}>{fullName(selected)}</Text>
            <Text style={styles.text}>
              {selected.working
                ? 'Trabajando · Registrar check-out'
                : 'Sin trabajar · Registrar check-in'}
            </Text>
            <Field
              label="Mail del empleado"
              value={email}
              onChangeText={setEmail}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              editable={!action.busy}
            />
            <Field
              label="Contraseña del empleado"
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              maxLength={128}
              editable={!action.busy}
            />
            <Button
              title={
                selected.working ? 'Confirmar check-out' : 'Confirmar check-in'
              }
              busy={action.busy}
              disabled={!email.trim() || !password}
              onPress={() => {
                void action.run(
                  async () => {
                    try {
                      await repository.markAttendance(
                        selected,
                        email,
                        password,
                      );
                      setSelected(null);
                      setEmail('');
                    } finally {
                      setPassword('');
                      await reload();
                    }
                  },
                  selected.working
                    ? 'Check-out registrado.'
                    : 'Check-in registrado.',
                );
              }}
            />
            <Button
              title="Cancelar"
              secondary
              disabled={action.busy}
              onPress={reset}
            />
          </View>
        ) : (
          <>
            {!loading && !error && !employees.length && (
              <EmptyState message="No hay empleados activos en este puesto." />
            )}
            {employees.map((row) => (
              <View key={row.id} style={styles.card}>
                <Text style={styles.heading}>{fullName(row)}</Text>
                <Text style={styles.text}>
                  {row.working ? 'Trabajando' : 'Sin trabajar'}
                </Text>
                <Button
                  title={`${row.working ? 'Check-out' : 'Check-in'} · ${fullName(row)}`}
                  disabled={!!error || loading}
                  onPress={() => {
                    reset();
                    setSelected(row);
                  }}
                />
              </View>
            ))}
          </>
        )}
      </Screen>
      <CheckInOptions disabled={action.busy} onOpen={reset} />
    </SafeAreaView>
  );
}
