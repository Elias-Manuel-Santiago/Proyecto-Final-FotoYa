/**
 * @file
 * Construye navegación según permisos y estado del usuario. Reúne accesos disponibles y cierre
 * de sesión.
 */
import { Link, usePathname, type Href } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  can,
  canWork,
  roleLabels,
  type Permission,
} from '../../domain/permissions';
import { useWorkspace } from '../../providers/AppProvider';
import { colors, styles } from '../ui/theme';

const links: { href: Href; label: string; permission?: Permission }[] = [
  { href: '/home', label: 'Inicio' },
  { href: '/reports', label: 'Estadísticas', permission: 'reports.read' },
  { href: '/employees', label: 'Usuarios', permission: 'employees.read' },
  { href: '/clients', label: 'Clientes', permission: 'clients.read' },
  { href: '/stations', label: 'Puestos', permission: 'stations.manage' },
  { href: '/prices', label: 'Precios', permission: 'prices.manage' },
  { href: '/attendance', label: 'Horarios', permission: 'attendance.read' },
  { href: '/photos', label: 'Fotos', permission: 'photos.read' },
  { href: '/sales', label: 'Ventas', permission: 'sales.read' },
  {
    href: '/my-attendance',
    label: 'Mi asistencia',
    permission: 'attendance.self',
  },
  { href: '/profile', label: 'Mi usuario' },
];

// Construye accesos de navegación según permisos y contexto del usuario.
export function WorkspaceHeader() {
  const { employee, data } = useWorkspace();
  const pathname = usePathname();
  const station = data.stations.find((row) => row.id === employee.stationId);
  return (
    <SafeAreaView
      edges={['top', 'left', 'right']}
      style={{
        backgroundColor: colors.surface,
        borderBottomWidth: 1,
        borderColor: colors.border,
      }}
    >
      <View
        style={{
          padding: 12,
          gap: 8,
          maxWidth: 960,
          width: '100%',
          alignSelf: 'center',
        }}
      >
        <Text style={styles.label}>
          Foto Ya · {roleLabels[employee.roleId]} ·{' '}
          {station?.name ??
            employee.stationName ??
            (employee.stationId
              ? `Puesto ${employee.stationId}`
              : 'Sin puesto asignado')}
        </Text>
        <Text style={styles.muted}>Conectado al servidor</Text>
        <View style={styles.row}>
          {links
            .filter((link) =>
              canWork(employee)
                ? !link.permission || can(employee, link.permission)
                : link.href === '/profile',
            )
            .map((link) => (
              <Link
                key={String(link.href)}
                href={link.href}
                style={{
                  padding: 10,
                  minHeight: 44,
                  color: colors.text,
                  fontSize: 15,
                  backgroundColor:
                    pathname === link.href
                      ? colors.lavender
                      : colors.background,
                }}
              >
                {link.label}
              </Link>
            ))}
        </View>
      </View>
    </SafeAreaView>
  );
}
