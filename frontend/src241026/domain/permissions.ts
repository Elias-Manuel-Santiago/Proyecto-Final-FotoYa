/**
 * @file
 * Resuelve visibilidad, alcance y roles asignables en la interfaz. Usa permisos del servidor y
 * una matriz de respaldo si falta ese campo.
 */
import type { Employee, RoleId } from './models';

export const roleLabels: Record<RoleId, string> = {
  owner: 'Dueño',
  manager: 'Encargado',
  secretary: 'Secretario',
  photographer: 'Camarógrafo',
  seller: 'Vendedor',
  client: 'Cliente',
};

export type Permission =
  | 'clients.read'
  | 'clients.manage'
  | 'reports.read'
  | 'employees.read'
  | 'employees.manage'
  | 'attendance.read'
  | 'attendance.self'
  | 'photos.read'
  | 'photos.upload'
  | 'sales.read'
  | 'sales.create'
  | 'counts.read'
  | 'photos.assign'
  | 'catalog.read'
  | 'prices.manage'
  | 'stations.manage';

// Adaptador inicial de la relación roles-permisos. El backend proveerá las asignaciones.
export const rolePermissions: Record<RoleId, readonly Permission[]> = {
  owner: [
    'clients.read',
    'clients.manage',
    'prices.manage',
    'stations.manage',
    'counts.read',
    'catalog.read',
    'reports.read',
    'employees.read',
    'employees.manage',
    'attendance.read',
    'attendance.self',
    'sales.read',
  ],
  manager: [
    'prices.manage',
    'counts.read',
    'catalog.read',
    'photos.assign',
    'reports.read',
    'employees.read',
    'employees.manage',
    'attendance.read',
    'attendance.self',
    'photos.read',
    'photos.upload',
    'sales.read',
    'sales.create',
  ],
  secretary: [
    'counts.read',
    'catalog.read',
    'reports.read',
    'employees.read',
    'attendance.read',
    'attendance.self',
    'sales.read',
  ],
  photographer: [
    'photos.read',
    'photos.upload',
    'photos.assign',
    'counts.read',
    'attendance.self',
    'catalog.read',
  ],
  seller: [
    'sales.read',
    'sales.create',
    'counts.read',
    'attendance.self',
    'catalog.read',
  ],
  client: ['photos.read'],
};

const globalRoles: readonly RoleId[] = ['owner', 'secretary'];

// Combina cuenta activa, jornada, kiosco y permisos para habilitar acciones de interfaz.
export function can(employee: Employee, permission: Permission) {
  return (
    employee.active &&
    canWork(employee) &&
    !employee.kioskMode &&
    (employee.permissions ?? rolePermissions[employee.roleId]).includes(
      permission,
    )
  );
}

// Exige jornada abierta a los roles que la necesitan.
export function canWork(employee: Employee) {
  return (
    !['secretary', 'photographer', 'seller'].includes(employee.roleId) ||
    employee.working === true
  );
}

// Comprueba si el usuario activo tiene alcance global o pertenece al puesto.
export function hasStationAccess(employee: Employee, stationId: string) {
  return (
    employee.active &&
    (globalRoles.includes(employee.roleId) || employee.stationId === stationId)
  );
}

// Detiene una acción local si no está habilitada para el usuario.
export function requirePermission(employee: Employee, permission: Permission) {
  if (!can(employee, permission))
    throw new Error('No tenés permiso para esta operación.');
}

// Rechaza una acción local sobre un puesto fuera del alcance.
export function requireStation(employee: Employee, stationId: string) {
  if (!hasStationAccess(employee, stationId))
    throw new Error('El puesto está fuera de tu alcance.');
}

// Define los roles ofrecidos en el formulario según quién administra usuarios.
export function assignableRoles(employee: Employee): RoleId[] {
  return employee.roleId === 'owner'
    ? ['owner', 'manager', 'secretary', 'photographer', 'seller', 'client']
    : ['manager', 'photographer', 'seller'];
}
