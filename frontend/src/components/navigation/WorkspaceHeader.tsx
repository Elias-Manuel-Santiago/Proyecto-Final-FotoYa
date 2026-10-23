import { Link, usePathname, type Href } from 'expo-router';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { Image } from 'expo-image';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  can,
  canWork,
  roleLabels,
  type Permission,
} from '../../domain/permissions';
import { useWorkspace } from '../../providers/AppProvider';
import { useNavigationMode } from '../../hooks/useNavigationMode';
import { Icon, type IconName } from '../ui/Icon';
import { useTheme } from '../ui/theme';
const links: {
  href: Href;
  label: string;
  permission?: Permission;
  icon: IconName;
}[] = [
  { href: '/home', icon: 'inicio', label: 'Inicio' },
  {
    href: '/reports',
    icon: 'estadisticas',
    label: 'Estadísticas',
    permission: 'reports.read',
  },
  {
    href: '/employees',
    icon: 'usuarios',
    label: 'Usuarios',
    permission: 'employees.read',
  },
  {
    href: '/clients',
    icon: 'usuarios',
    label: 'Clientes',
    permission: 'clients.read',
  },
  {
    href: '/stations',
    icon: 'puestos',
    label: 'Puestos',
    permission: 'stations.manage',
  },
  {
    href: '/prices',
    icon: 'precios',
    label: 'Precios',
    permission: 'prices.manage',
  },
  {
    href: '/attendance',
    icon: 'horarios',
    label: 'Horarios',
    permission: 'attendance.read',
  },
  {
    href: '/photos',
    icon: 'fotos-galeria',
    label: 'Fotos',
    permission: 'photos.read',
  },
  { href: '/sales', icon: 'ventas', label: 'Ventas', permission: 'sales.read' },
  {
    href: '/my-attendance',
    icon: 'asistencia',
    label: 'Mi asistencia',
    permission: 'attendance.self',
  },
  { href: '/profile', icon: 'mi-usuario', label: 'Mi usuario' },
];

export function WorkspaceHeader({ children }: { children: ReactNode }) {
  const { colors, styles } = useTheme();
  const { employee, data } = useWorkspace();
  const pathname = usePathname();
  const { bottom } = useNavigationMode();
  const [expanded, setExpanded] = useState(true);
  const station = data.stations.find((row) => row.id === employee.stationId);
  const showStation = !['owner', 'client'].includes(employee.roleId);
  const navigation = links.filter((link) =>
    canWork(employee)
      ? !link.permission || can(employee, link.permission)
      : link.href === '/profile',
  );
  const items = navigation.map((link) => {
    const active =
      pathname === link.href || pathname.startsWith(`${link.href}/`);
    return (
      <Link key={String(link.href)} href={link.href} asChild>
        <Pressable
          accessibilityRole="tab"
          accessibilityLabel={link.label}
          accessibilityState={{ selected: active }}
          style={{
            flexDirection: bottom ? 'column' : 'row',
            alignItems: 'center',
            justifyContent: bottom || !expanded ? 'center' : 'flex-start',
            gap: 8,
            padding: 12,
            minHeight: 50,
            minWidth: bottom ? 84 : 48,
            borderRadius: 14,
            backgroundColor: active ? colors.lavender : 'transparent',
            borderLeftWidth: !bottom && active ? 3 : 0,
            borderColor: colors.primary,
          }}
        >
          <Icon
            name={link.icon}
            selected={active}
            color={active ? colors.primary : colors.text}
          />
          {(bottom || expanded) && (
            <Text
              style={{
                color: active ? colors.primary : colors.text,
                fontSize: bottom ? 11 : 14,
                fontWeight: active ? '700' : '500',
              }}
            >
              {link.label}
            </Text>
          )}
        </Pressable>
      </Link>
    );
  });
  const brand = (
    <Image
      source={require('../../../assets/images/main-icon.jpg')}
      accessibilityLabel="FotoYa"
      style={{ width: 48, height: 48, borderRadius: 14 }}
    />
  );
  return (
    <View
      style={{
        flex: 1,
        flexDirection: bottom ? 'column' : 'row',
        backgroundColor: colors.background,
      }}
    >
      {!bottom && (
        <SafeAreaView
          edges={['top', 'bottom', 'left']}
          style={{
            width: expanded ? 232 : 80,
            backgroundColor: colors.surface,
            borderRightWidth: 1,
            borderColor: colors.border,
          }}
        >
          <View style={{ padding: 14, gap: 16, flex: 1 }}>
            <View
              style={{ flexDirection: 'row', gap: 10, alignItems: 'center' }}
            >
              {brand}
              {expanded && <Text style={styles.heading}>FotoYa!</Text>}
            </View>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                expanded ? 'Contraer navegación' : 'Expandir navegación'
              }
              accessibilityState={{ expanded }}
              onPress={() => setExpanded(!expanded)}
              style={{
                minHeight: 44,
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: 12,
                backgroundColor: colors.lavender,
              }}
            >
              <Icon name={expanded ? 'flecha-izq' : 'flecha-der'} />
            </Pressable>
            <ScrollView contentContainerStyle={{ gap: 6 }}>{items}</ScrollView>
            {expanded && (
              <Text style={styles.muted}>{roleLabels[employee.roleId]}</Text>
            )}
          </View>
        </SafeAreaView>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        <SafeAreaView
          edges={['top', 'right', 'left']}
          style={{ backgroundColor: colors.surface }}
        >
          <View
            style={{
              minHeight: 76,
              padding: 12,
              paddingLeft: bottom ? 76 : 24,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              borderBottomWidth: 1,
              borderColor: colors.border,
            }}
          >
            {bottom && brand}
            <View style={{ flex: 1 }}>
              <Text style={styles.label}>
                {bottom ? 'FotoYa!' : roleLabels[employee.roleId]}
              </Text>
              {showStation && (
                <Text style={styles.muted}>
                  {station?.name ??
                    employee.stationName ??
                    'Sin puesto asignado'}
                </Text>
              )}
            </View>
            <Text style={styles.muted}>{employee.firstName}</Text>
          </View>
        </SafeAreaView>
        {children}
      </View>
      {bottom && (
        <SafeAreaView
          edges={['bottom', 'left', 'right']}
          style={{
            backgroundColor: colors.surface,
            borderTopWidth: 1,
            borderColor: colors.border,
          }}
        >
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator
            contentContainerStyle={{ padding: 8, gap: 4 }}
          >
            {items}
          </ScrollView>
        </SafeAreaView>
      )}
    </View>
  );
}
