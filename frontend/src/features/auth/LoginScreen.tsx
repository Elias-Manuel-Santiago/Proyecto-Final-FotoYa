import { Redirect } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { useApp } from '../../providers/AppProvider';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Feedback } from '../../components/ui/Feedback';
import { Screen } from '../../components/ui/Screen';
import { styles } from '../../components/ui/theme';

export function LoginScreen() {
  const { employee, loading, error, login } = useApp();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  if (employee) return <Redirect href="/home" />;
  return (
    <Screen title="Foto Ya">
      <Text style={styles.heading}>Iniciar sesión</Text>
      <Field
        label="Email"
        value={email}
        onChangeText={setEmail}
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        editable={!loading}
      />
      <Field
        label="Contraseña"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        maxLength={128}
        autoCapitalize="none"
        autoCorrect={false}
        editable={!loading}
      />
      <Feedback error={error} />
      <Button
        title="Ingresar"
        busy={loading}
        disabled={!email.trim() || !password}
        onPress={() => {
          void login(email, password).catch(() => undefined);
        }}
      />
    </Screen>
  );
}
