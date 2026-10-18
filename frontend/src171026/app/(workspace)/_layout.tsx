import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { Feedback } from '../../components/ui/Feedback';
import { Button } from '../../components/ui/Button';
import { WorkspaceHeader } from '../../components/navigation/WorkspaceHeader';
import { useApp } from '../../providers/AppProvider';

export default function WorkspaceLayout() {
  const { employee, loading, error, refresh } = useApp();
  if (loading) return <ActivityIndicator accessibilityLabel="Cargando" />;
  if (!employee) return <Redirect href="/" />;
  return (
    <View style={{ flex: 1 }}>
      <WorkspaceHeader />
      {!!error && (
        <View>
          <Feedback error={error} />
          <Button
            title="Reintentar conexión"
            onPress={() => {
              void refresh().catch(() => undefined);
            }}
          />
        </View>
      )}
      <Stack screenOptions={{ headerShown: false }} />
    </View>
  );
}
