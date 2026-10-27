/** Recupera una contraseña local mediante el código enviado al correo de la cuenta. */
import { Redirect, router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text } from 'react-native';
import { Button } from '../../components/ui/Button';
import { Feedback } from '../../components/ui/Feedback';
import { Field } from '../../components/ui/Field';
import { PasswordField } from '../../components/ui/PasswordField';
import { Screen } from '../../components/ui/Screen';
import { useTheme } from '../../components/ui/theme';
import { useAction } from '../../hooks/useAction';
import { useApp } from '../../providers/AppProvider';

interface RecoveryChallenge {
  recoveryToken: string;
  email: string;
  expiresIn: number;
}

export function PasswordRecoveryScreen() {
  const { employee, repository } = useApp();
  const { styles } = useTheme();
  const action = useAction();
  const [email, setEmail] = useState('');
  const [challenge, setChallenge] = useState<RecoveryChallenge | null>(null);
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [canResend, setCanResend] = useState(false);
  const [changed, setChanged] = useState(false);

  useEffect(() => {
    if (!challenge) return;
    const timer = setTimeout(() => setCanResend(true), 60000);
    return () => clearTimeout(timer);
  }, [challenge]);

  async function requestCode() {
    const address = (challenge?.email ?? email).trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(address))
      throw new Error('Ingresá un email válido.');
    const value = await repository.api.post<RecoveryChallenge>(
      'auth/password/reset/start',
      { email: address },
    );
    setChallenge(value);
    setCanResend(false);
    setCode('');
  }

  async function confirm() {
    if (!challenge) return;
    if (!/^\d{6}$/.test(code))
      throw new Error('Ingresá el código de seis dígitos.');
    if (password.length < 12 || password.length > 128)
      throw new Error('La contraseña debe tener entre 12 y 128 caracteres.');
    if (password !== confirmation)
      throw new Error('Las contraseñas no coinciden.');
    await repository.api.post('auth/password/reset/confirm', {
      recoveryToken: challenge.recoveryToken,
      code,
      password,
    });
    setPassword('');
    setConfirmation('');
    setCode('');
    setChallenge(null);
    setChanged(true);
  }

  if (employee)
    return (
      <Redirect href={employee.roleId === 'client' ? '/photos' : '/home'} />
    );
  return (
    <Screen compact title="Foto Ya">
      <Text style={styles.heading}>Recuperar contraseña</Text>
      {changed ? (
        <Feedback success="Tu contraseña se actualizó. Iniciá sesión con la nueva contraseña." />
      ) : (
        <>
          {challenge ? (
            <>
              <Text style={styles.text}>{challenge.email}</Text>
              <Text style={styles.muted}>
                Si el correo corresponde a una cuenta con contraseña, recibirás
                un código de seis dígitos. Vence en diez minutos. Si ya pediste
                uno, esperá un minuto y volvé a solicitarlo.
              </Text>
              <Field
                label="Código de recuperación"
                value={code}
                onChangeText={(value) => {
                  setCode(value.replace(/\D/g, ''));
                  action.clear();
                }}
                keyboardType="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                editable={!action.busy}
              />
              <Text style={styles.muted}>Usá entre 12 y 128 caracteres.</Text>
              <PasswordField
                label="Nueva contraseña"
                value={password}
                onChangeText={(value) => {
                  setPassword(value);
                  action.clear();
                }}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                maxLength={128}
                editable={!action.busy}
              />
              <PasswordField
                label="Repetir nueva contraseña"
                value={confirmation}
                onChangeText={(value) => {
                  setConfirmation(value);
                  action.clear();
                }}
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="new-password"
                maxLength={128}
                editable={!action.busy}
              />
            </>
          ) : (
            <>
              <Text style={styles.muted}>
                Ingresá el email de tu cuenta para recibir un código de
                recuperación. Si usás Google u otro servicio, ingresá con ese
                proveedor.
              </Text>
              <Field
                label="Email"
                value={email}
                onChangeText={(value) => {
                  setEmail(value);
                  action.clear();
                }}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                autoComplete="email"
                maxLength={254}
                editable={!action.busy}
              />
            </>
          )}
          <Feedback error={action.error} success={action.success} />
          <Button
            title={challenge ? 'Restablecer contraseña' : 'Enviar código'}
            busy={action.busy}
            onPress={() => void action.run(challenge ? confirm : requestCode)}
          />
          {challenge && (
            <>
              <Button
                title="Reenviar código"
                secondary
                disabled={action.busy || !canResend}
                onPress={() =>
                  void action.run(
                    requestCode,
                    'Solicitamos un nuevo código. Revisá tu correo.',
                  )
                }
              />
              {!canResend && (
                <Text style={styles.muted}>
                  Podés reenviar el código después de un minuto.
                </Text>
              )}
              <Button
                title="Usar otro email"
                secondary
                disabled={action.busy}
                onPress={() => {
                  setChallenge(null);
                  setCode('');
                  setPassword('');
                  setConfirmation('');
                  setCanResend(false);
                  action.clear();
                }}
              />
            </>
          )}
        </>
      )}
      <Button
        title="Volver a iniciar sesión"
        secondary
        disabled={action.busy}
        onPress={() => router.replace('/')}
      />
    </Screen>
  );
}
