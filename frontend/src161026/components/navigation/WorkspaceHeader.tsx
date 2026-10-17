import { Link, usePathname, type Href } from 'expo-router';
import { Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { can, roleLabels, type Permission } from '../../domain/permissions';
import { useWorkspace } from '../../providers/AppProvider';
import { colors, styles } from '../ui/theme';

const links: { href: Href; label: string; permission?: Permission }[] = [
  { href: '/home', label: 'Inicio' },
  { href: '/reports', label: 'Estadísticas', permission: 'reports.read' },
  { href: '/employees', label: 'Usuarios', permission: 'employees.read' },
  { href: '/stations', label: 'Puestos', permission: 'stations.manage' },
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
          {station?.name ?? 'Sin puesto asignado'}
        </Text>
        <Text style={styles.muted}>Conectado al servidor</Text>
        <View style={styles.row}>
          {links
            .filter(
              (link) => !link.permission || can(employee, link.permission),
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
