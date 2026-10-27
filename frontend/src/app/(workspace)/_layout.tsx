/**
 * @file
 * Protege el área de trabajo y monta su encabezado. Redirige a login sin sesión y a perfil
 * cuando falta jornada requerida.
 */
import { Redirect, Stack, usePathname } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { Feedback } from '../../components/ui/Feedback';
import { Button } from '../../components/ui/Button';
import { WorkspaceHeader } from '../../components/navigation/WorkspaceHeader';
import { useApp } from '../../providers/AppProvider';
import { useTheme } from '../../components/ui/theme';
import { canWork } from '../../domain/permissions';

// Resuelve sesión y jornada antes de montar pantallas privadas y encabezado.
export default function WorkspaceLayout() {
  const { colors } = useTheme();
  const { employee, loading, error, refresh } = useApp();
  const pathname = usePathname();
  if (loading) return <ActivityIndicator accessibilityLabel="Cargando" />;
  if (!employee) return <Redirect href="/" />;
  if (!canWork(employee) && pathname !== '/profile')
    return <Redirect href="/profile" />;
  if (employee.roleId === 'client' && pathname === '/home')
    return <Redirect href="/photos" />;
  return (
    <WorkspaceHeader>
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
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      />
    </WorkspaceHeader>
  );
}
