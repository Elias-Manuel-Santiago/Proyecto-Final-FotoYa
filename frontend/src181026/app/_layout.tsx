import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppProvider, useApp } from '../providers/AppProvider';

function AppNavigator() {
  const { employee } = useApp();
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
      <AppProvider>
        <AppNavigator />
      </AppProvider>
    </SafeAreaProvider>
  );
}
