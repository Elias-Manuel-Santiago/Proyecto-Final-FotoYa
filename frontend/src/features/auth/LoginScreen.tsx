import { Image } from 'expo-image';
/**
 * @file
 * Coordina login, registro local/social y confirmación. Acepta sesiones mediante AppProvider y
 * consume el retorno social una vez.
 */
import { Link, Redirect } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { useApp } from '../../providers/AppProvider';
import { useSocial } from '../../providers/social-context';
import { ApiError } from '../../data/api-client';
import { useLoginErrors, type AuthMode } from './useLoginErrors';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { PasswordField } from '../../components/ui/PasswordField';
import { Feedback } from '../../components/ui/Feedback';
import { Screen } from '../../components/ui/Screen';
import { useTheme } from '../../components/ui/theme';

interface AuthResult {
  token?: string;
  verificationToken?: string;
  registrationRequired?: boolean;
  email?: string;
}

// Coordina acceso local, registro, confirmación de correo e identidad externa.
export function LoginScreen() {
  const { styles } = useTheme();
  const { employee, loading, login, repository, acceptSession } = useApp();
  const social = useSocial();
  const [mode, setMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [dni, setDni] = useState('');
  const [code, setCode] = useState('');
  const [verificationToken, setVerificationToken] = useState('');
  const [idToken, setIdToken] = useState('');
  const [busy, setBusy] = useState(false);
  const {
    localError,
    fieldErrors,
    changeField,
    clearErrors,
    handleError,
    validate,
  } = useLoginErrors(mode);
  const [notice, setNotice] = useState('');
  const [canResend, setCanResend] = useState(false);
  const consumed = useRef('');
  const locked = busy || loading || social.loading;
  useEffect(() => {
    if (!verificationToken) return;
    const timer = setTimeout(() => setCanResend(true), 60000);
    return () => clearTimeout(timer);
  }, [verificationToken]);
  // Interpreta si la respuesta trae sesión, confirmación pendiente o datos personales faltantes.
  async function result(value: AuthResult) {
    clearErrors();
    if (value.token) {
      setIdToken('');
      setPassword('');
      await acceptSession(value.token);
    } else if (value.verificationToken) {
      setVerificationToken(value.verificationToken);
      setCanResend(false);
      setCode('');
      setPassword('');
      setConfirmation('');
      setEmail(value.email ?? email);
      setMode('verify');
      setNotice(
        'Enviamos un código de seis dígitos a tu correo. Vence en diez minutos.',
      );
    } else if (value.registrationRequired) {
      setEmail(value.email ?? '');
      setMode('social');
    }
  }
  // Gestiona el estado ocupado y convierte fallos de autenticación en mensajes del formulario.
  async function run(action: () => Promise<void>, fieldFeedback = false) {
    setBusy(true);
    setNotice('');
    clearErrors();
    try {
      await action();
    } catch (cause) {
      handleError(cause, fieldFeedback);
    } finally {
      setBusy(false);
    }
  }
  useEffect(() => {
    const token = social.pendingToken;
    if (!token || consumed.current === token) return;
    consumed.current = token;
    social.consume();
    setIdToken(token);
    void run(async () =>
      result(
        await repository.api.post<AuthResult>('auth/social', {
          idToken: token,
        }),
      ),
    );
    // El token se consume una sola vez al regresar de Auth0 en web.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [social.pendingToken]);
  // Valida los campos del modo actual y ejecuta el paso correspondiente de acceso o registro.
  async function submit() {
    if (
      !validate({
        email,
        password,
        confirmation,
        firstName,
        lastName,
        dni,
        code,
      })
    )
      return;
    // Una cuenta local sin verificar retoma la confirmación de correo después de validar sus credenciales.
    if (mode === 'login') {
      try {
        await login(email, password);
      } catch (cause) {
        if (!(cause instanceof ApiError) || cause.code !== 'EMAIL_UNVERIFIED')
          throw cause;
        await result(
          await repository.api.post<AuthResult>('auth/verification/start', {
            email: email.trim(),
            password,
          }),
        );
      }
    } else if (mode === 'register') {
      await result(
        await repository.api.post<AuthResult>('auth/register', {
          firstName,
          lastName,
          dni,
          email: email.trim(),
          password,
        }),
      );
    } else if (mode === 'social') {
      await result(
        await repository.api.post<AuthResult>('auth/social', {
          idToken,
          firstName,
          lastName,
          dni,
        }),
      );
    } else {
      await result(
        await repository.api.post<AuthResult>('auth/verification/confirm', {
          verificationToken,
          code,
        }),
      );
    }
  }
  if (employee) return <Redirect href="/home" />;
  const creating = mode === 'register' || mode === 'social';
  return (
    <Screen compact title="Foto Ya">
      <Image
        source={require('../../../assets/images/main-icon.jpg')}
        accessibilityLabel="FotoYa!"
        style={{
          width: 112,
          height: 112,
          borderRadius: 24,
          alignSelf: 'center',
          marginBottom: 8,
        }}
      />

      <Text style={styles.heading}>
        {mode === 'verify'
          ? 'Confirmá tu correo'
          : creating
            ? 'Crear cuenta'
            : 'Iniciar sesión'}
      </Text>
      {creating && (
        <>
          <Field
            label="Nombre"
            value={firstName}
            onChangeText={changeField('firstName', setFirstName)}
            error={fieldErrors.firstName}
            maxLength={100}
            editable={!locked}
          />
          <Field
            label="Apellido"
            value={lastName}
            onChangeText={changeField('lastName', setLastName)}
            error={fieldErrors.lastName}
            maxLength={100}
            editable={!locked}
          />
          <Field
            label="DNI"
            value={dni}
            onChangeText={changeField('dni', setDni)}
            error={fieldErrors.dni}
            keyboardType="numeric"
            maxLength={20}
            editable={!locked}
          />
        </>
      )}
      {mode === 'verify' || mode === 'social' ? (
        <Text style={styles.text}>{email}</Text>
      ) : (
        <Field
          label="Email"
          value={email}
          onChangeText={changeField('email', setEmail)}
          error={fieldErrors.email}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          maxLength={254}
          editable={!locked}
        />
      )}
      {(mode === 'login' || mode === 'register') && (
        <PasswordField
          key={mode}
          label="Contraseña"
          value={password}
          onChangeText={changeField('password', setPassword)}
          error={fieldErrors.password}
          maxLength={128}
          autoCapitalize="none"
          autoCorrect={false}
          editable={!locked}
        />
      )}
      {mode === 'login' && (
        <Link href="/forgot-password" asChild>
          <Pressable
            accessibilityRole="link"
            disabled={locked}
            accessibilityState={{ disabled: locked }}
            style={{ alignSelf: 'flex-start', paddingVertical: 8 }}
          >
            <Text style={[styles.muted, { textDecorationLine: 'underline' }]}>
              Olvidé mi contraseña
            </Text>
          </Pressable>
        </Link>
      )}
      {mode === 'register' && (
        <>
          <Text style={styles.muted}>Usá entre 8 y 128 caracteres.</Text>
          <PasswordField
            label="Repetir contraseña"
            value={confirmation}
            onChangeText={changeField('confirmation', setConfirmation)}
            error={fieldErrors.confirmation}
            maxLength={128}
            autoCapitalize="none"
            autoCorrect={false}
            editable={!locked}
          />
        </>
      )}
      {mode === 'verify' && (
        <Field
          label="Código de verificación"
          value={code}
          onChangeText={changeField('code', setCode)}
          error={fieldErrors.code}
          keyboardType="numeric"
          maxLength={6}
          editable={!locked}
        />
      )}
      <Feedback error={localError || social.error} success={notice} />
      <Button
        title={
          mode === 'verify'
            ? 'Confirmar correo'
            : creating
              ? 'Crear cuenta'
              : 'Ingresar'
        }
        busy={locked}
        disabled={locked}
        onPress={() => {
          void run(submit, true);
        }}
      />
      {mode === 'verify' && (
        <Button
          title="Reenviar código"
          secondary
          disabled={locked || !canResend}
          onPress={() => {
            void run(async () =>
              result(
                await repository.api.post<AuthResult>(
                  'auth/verification/resend',
                  { verificationToken },
                ),
              ),
            );
          }}
        />
      )}
      <Button
        title={mode === 'login' ? 'Crear cuenta' : 'Volver'}
        secondary
        disabled={locked}
        onPress={() => {
          setMode(mode === 'login' ? 'register' : 'login');
          clearErrors();
          setNotice('');
          setPassword('');
          setConfirmation('');
          setIdToken('');
          setVerificationToken('');
        }}
      />
      {(mode === 'login' || mode === 'register') && (
        <>
          <Text style={styles.heading}>Continuar con</Text>
          {(
            [
              ['Google', 'google-oauth2'],
              ['Apple', 'apple'],
              ['Amazon', 'amazon'],
            ] as const
          ).map(([label, connection]) => (
            <Button
              key={connection}
              title={label}
              secondary
              disabled={locked || !social.enabled}
              onPress={() => {
                void run(async () => {
                  const token = await social.signIn(connection);
                  setIdToken(token);
                  await result(
                    await repository.api.post<AuthResult>('auth/social', {
                      idToken: token,
                    }),
                  );
                });
              }}
            />
          ))}
          {!social.enabled && (
            <Text style={styles.muted}>
              El acceso con servicios externos no está disponible por el
              momento.
            </Text>
          )}
        </>
      )}
    </Screen>
  );
}
