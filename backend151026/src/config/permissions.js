const administrative = ['reports.read', 'counts.read', 'employees.read', 'employees.manage', 'attendance.read', 'attendance.self', 'sales.read', 'catalog.read'];
export const rolePermissions = {
  dueno: administrative,
  encargado: [...administrative, 'photos.read', 'photos.upload', 'photos.assign', 'sales.create'],
  secretario: ['reports.read', 'counts.read', 'employees.read', 'attendance.read', 'attendance.self', 'sales.read', 'catalog.read'],
  camarografo: ['photos.read', 'photos.upload', 'photos.assign', 'counts.read', 'attendance.self', 'catalog.read'],
  vendedor: ['sales.read', 'sales.create', 'counts.read', 'attendance.self', 'catalog.read'],
  cliente: ['photos.read'],
};
