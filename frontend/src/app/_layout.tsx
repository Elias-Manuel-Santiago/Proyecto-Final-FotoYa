import { useTheme } from '../components/ui/theme';
/**
 * @file
 * Monta proveedores y navegación tras restaurar sesión. Separa rutas habituales del check-in
 * mientras el kiosco está bloqueado.
 */
import { ThemeProvider } from '../providers/ThemeProvider';
import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from '../providers/AppProvider';
import { SocialProvider } from '../providers/SocialProvider';
import { ActivityIndicator, View } from 'react-native';
import { Button } from '../components/ui/Button';
import { Feedback } from '../components/ui/Feedback';

// Decide las rutas disponibles según restauración, sesión y bloqueo del kiosco.
function AppNavigator() {
  const { colors } = useTheme();
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
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
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

// Monta proveedores compartidos antes de crear la navegación de la aplicación.
export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <SocialProvider>
          <AppProvider>
            <AppNavigator />
          </AppProvider>
        </SocialProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
