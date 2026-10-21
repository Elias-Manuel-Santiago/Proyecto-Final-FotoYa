import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from '../providers/AppProvider';
import { SocialProvider } from '../providers/SocialProvider';
import { ActivityIndicator, View } from 'react-native';
import { Button } from '../components/ui/Button';
import { Feedback } from '../components/ui/Feedback';

function AppNavigator() {
  const { employee, restoring, loading, error, restoreSession, logout } =
    useApp();
  if (restoring)
    return (
      <View style={{ flex: 1, justifyContent: 'center', padding: 24, gap: 16 }}>
        {loading && (
          <ActivityIndicator accessibilityLabel="Recuperando sesión" />
        )}
        {!!error && <Feedback error={error} />}
        {!loading && (
          <>
            <Button
              title="Reintentar conexión"
              onPress={() => void restoreSession()}
            />
            <Button
              title="Cerrar sesión"
              onPress={() => void logout().catch(() => undefined)}
            />
          </>
        )}
      </View>
    );
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Protected guard={!employee?.kioskMode}>
        <Stack.Screen name="index" />
        <Stack.Screen name="(workspace)" />
        <Stack.Screen name="+not-found" />
      </Stack.Protected>
      <Stack.Protected guard={!!employee?.kioskMode}>
        <Stack.Screen name="check-in" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <SocialProvider>
        <AppProvider>
          <AppNavigator />
        </AppProvider>
      </SocialProvider>
    </SafeAreaProvider>
  );
}
