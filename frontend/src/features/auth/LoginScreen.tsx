import { Image } from 'expo-image';
/**
 * @file
 * Coordina login, registro local/social y confirmación. Acepta sesiones mediante AppProvider y
 * consume el retorno social una vez.
 */
import { Link, Redirect } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useApp } from '../../providers/AppProvider';
import { useSocial } from '../../providers/social-context';
import { ApiError } from '../../data/api-client';
import { useLoginErrors, type AuthMode } from './useLoginErrors';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { PasswordField } from '../../components/ui/PasswordField';
import { Feedback } from '../../components/ui/Feedback';
import { LoginLayout } from './LoginLayout';
import { useTheme } from '../../components/ui/theme';

interface AuthResult {
  token?: string;
  verificationToken?: string;
  email?: string;
}

// Coordina acceso local, registro, confirmación de correo e identidad externa.
export function LoginScreen() {
  const { styles, colors } = useTheme();
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
  // Interpreta si la respuesta trae sesión o confirmación de correo pendiente.
  async function result(value: AuthResult) {
    clearErrors();
    if (value.token) {
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
  const creating = mode === 'register';
  return (
    <LoginLayout>
      <Text
        accessibilityRole="header"
        style={[
          styles.title,
          { fontSize: 30, lineHeight: 38, marginBottom: 4 },
        ]}
      >
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
      {mode === 'verify' ? (
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
            style={({ pressed }) => ({
              alignSelf: 'flex-end',
              minHeight: 44,
              justifyContent: 'center',
              marginTop: -8,
              opacity: locked ? 0.5 : pressed ? 0.7 : 1,
            })}
          >
            <Text style={[styles.muted, { color: colors.primary }]}>
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
      <View
        style={{
          flexDirection: 'row',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'center',
          columnGap: 6,
        }}
      >
        {mode !== 'verify' && (
          <Text style={styles.muted}>
            {creating ? '¿Ya tenés cuenta?' : '¿Todavía no tenés cuenta?'}
          </Text>
        )}
        <Pressable
          accessibilityRole="button"
          disabled={locked}
          accessibilityState={{ disabled: locked }}
          style={({ pressed }) => ({
            minHeight: 44,
            justifyContent: 'center',
            opacity: locked ? 0.5 : pressed ? 0.7 : 1,
          })}
          onPress={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            clearErrors();
            setNotice('');
            setPassword('');
            setConfirmation('');
            setVerificationToken('');
          }}
        >
          <Text
            style={[styles.muted, { color: colors.primary, fontWeight: '600' }]}
          >
            {mode === 'login'
              ? 'Crear cuenta'
              : creating
                ? 'Iniciar sesión'
                : 'Volver a iniciar sesión'}
          </Text>
        </Pressable>
      </View>
      {(mode === 'login' || mode === 'register') && (
        <>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 16 }}>
            <View
              style={{ flex: 1, height: 1, backgroundColor: colors.border }}
            />
            <Text style={styles.muted}>O continuá con</Text>
            <View
              style={{ flex: 1, height: 1, backgroundColor: colors.border }}
            />
          </View>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            {(
              [
                [
                  'Google',
                  'google-oauth2',
                  require('../../../assets/images/ui-svg/google.svg'),
                ],
                [
                  'Apple',
                  'apple',
                  require('../../../assets/images/ui-svg/apple.svg'),
                ],
                [
                  'Amazon',
                  'amazon',
                  require('../../../assets/images/ui-svg/amazon.svg'),
                ],
              ] as const
            ).map(([label, connection, logo]) => (
              <Pressable
                key={connection}
                accessibilityRole="button"
                accessibilityLabel={`Continuar con ${label}`}
                accessibilityState={{ disabled: locked || !social.enabled }}
                style={({ pressed }) => ({
                  flex: 1,
                  minWidth: 44,
                  minHeight: 48,
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderRadius: 12,
                  borderWidth: 1,
                  borderColor: colors.border,
                  backgroundColor: '#ffffff',
                  opacity: locked || !social.enabled ? 0.5 : pressed ? 0.75 : 1,
                })}
                disabled={locked || !social.enabled}
                onPress={() => {
                  void run(async () => {
                    const token = await social.signIn(connection);
                    await result(
                      await repository.api.post<AuthResult>('auth/social', {
                        idToken: token,
                      }),
                    );
                  });
                }}
              >
                <Image
                  source={logo}
                  contentFit="contain"
                  style={{ width: 24, height: 24 }}
                />
              </Pressable>
            ))}
          </View>
          {!social.enabled && (
            <Text style={styles.muted}>
              El acceso con servicios externos no está disponible por el
              momento.
            </Text>
          )}
        </>
      )}
    </LoginLayout>
  );
}
