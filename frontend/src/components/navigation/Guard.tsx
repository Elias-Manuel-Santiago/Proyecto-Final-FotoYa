/**
 * @file
 * Restringe vistas según permisos de interfaz. Cada solicitud sigue autorizándose en el
 * servidor.
 */
import type { ReactNode } from 'react';
import { Text } from 'react-native';
import { can, type Permission } from '../../domain/permissions';
import { useWorkspace } from '../../providers/AppProvider';
import { Screen } from '../ui/Screen';
import { styles } from '../ui/theme';

// Comprueba el permiso antes de montar el contenido de la ruta.
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
