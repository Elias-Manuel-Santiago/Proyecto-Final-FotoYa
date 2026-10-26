import type { Href } from 'expo-router';
import type { Employee, RoleId } from '../../domain/models';
import { can, canWork, type Permission } from '../../domain/permissions';
import type { IconName } from '../ui/Icon';
export interface NavigationItem {
  href: Href;
  label: string;
  permission?: Permission;
  icon: IconName;
  roles?: readonly RoleId[];
}
export const workspaceLinks: NavigationItem[] = [
  { href: '/home', icon: 'inicio', label: 'Inicio' },
  {
    href: '/cities',
    icon: 'ciudades',
    label: 'Ciudades',
    permission: 'catalog.read',
    roles: ['owner', 'secretary'],
  },
  {
    href: '/events',
    icon: 'eventos',
    label: 'Eventos',
    permission: 'catalog.read',
    roles: ['owner', 'secretary'],
  },
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
    permission: 'catalog.read',
    roles: ['owner', 'secretary'],
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
export function navigationFor(employee: Employee) {
  return workspaceLinks.filter((link) =>
    canWork(employee)
      ? (!link.roles || link.roles.includes(employee.roleId)) &&
        (!link.permission || can(employee, link.permission))
      : link.href === '/profile',
  );
}
export function isNavigationActive(pathname: string, href: Href) {
  return pathname === href || pathname.startsWith(`${href}/`);
}
