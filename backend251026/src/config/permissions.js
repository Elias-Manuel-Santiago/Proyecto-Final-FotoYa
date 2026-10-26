/**
 * @file
 * Define roles y permisos iniciales para preparar la base. Los permisos de cada solicitud se
 * leen de las relaciones persistidas.
 */
const administrative = ['reports.read', 'counts.read', 'employees.read', 'employees.manage', 'attendance.read', 'attendance.self', 'sales.read', 'catalog.read'];
// Esta matriz se usa para preparar datos iniciales; autenticar consulta las asignaciones de MySQL.
export const rolePermissions = {
  dueno: [...administrative, 'stations.manage', 'prices.manage', 'clients.read', 'clients.manage'],
  encargado: [...administrative, 'photos.read', 'photos.upload', 'photos.assign', 'sales.create', 'prices.manage'],
  secretario: ['reports.read', 'counts.read', 'employees.read', 'attendance.read', 'attendance.self', 'sales.read', 'catalog.read'],
  editor: ['photos.read', 'photos.upload', 'photos.assign', 'counts.read', 'attendance.self', 'catalog.read'],
  vendedor: ['sales.read', 'sales.create', 'counts.read', 'attendance.self', 'catalog.read'],
  camarografo: ['sales.read', 'counts.read', 'attendance.self', 'catalog.read'],
  cliente: ['photos.read'],
};
