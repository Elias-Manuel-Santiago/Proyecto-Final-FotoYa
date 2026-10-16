import type { ReactNode } from 'react';
import { Text } from 'react-native';
import { can, type Permission } from '../../domain/permissions';
import { useWorkspace } from '../../providers/AppProvider';
import { Screen } from '../ui/Screen';
import { styles } from '../ui/theme';

export function Guard({
  permission,
  children,
}: {
  permission: Permission;
  children: ReactNode;
}) {
  const { employee } = useWorkspace();
  return can(employee, permission) ? (
    children
  ) : (
    <Screen title="Acceso restringido">
      <Text style={styles.text}>
        No tenés permiso para acceder a esta vista.
      </Text>
    </Screen>
  );
}
