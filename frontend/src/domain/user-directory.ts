import { fullName } from './format';
import { hasStationAccess } from './permissions';
import type { Auth0User, Employee } from './models';

const labels: Record<string, string> = {
  local: 'Correo y contraseña (Foto Ya)',
  auth0: 'Correo y contraseña (Auth0)',
  'google-oauth2': 'Google',
  amazon: 'Amazon',
  github: 'GitHub',
  apple: 'Apple',
  facebook: 'Facebook',
  email: 'Código por correo',
  sms: 'Código por SMS',
};

export const authenticationLabel = (providers: string[]) =>
  providers.map((provider) => labels[provider] || provider).join(', ') ||
  'Proveedor desconocido';

interface DirectoryEntry {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  dni: string;
  stationId: string;
  active: boolean;
  authenticationProviders: string[];
  localUser?: Employee;
}

// Se vincula por identidad, nunca por correo: un mismo correo puede tener varias cuentas.
export function userDirectory(
  employees: Employee[],
  auth0Users: Auth0User[],
): DirectoryEntry[] {
  const subjects = new Map<string, Auth0User>();
  for (const user of auth0Users) {
    subjects.set(user.id, user);
    for (const identity of user.identities)
      subjects.set(identity.subject, user);
  }
  const linked = new Set<string>();
  const rows: DirectoryEntry[] = employees.map((employee) => {
    const external = employee.auth0Subject
      ? subjects.get(employee.auth0Subject)
      : undefined;
    if (external) linked.add(external.id);
    return {
      ...employee,
      id: `local:${employee.id}`,
      authenticationProviders: external?.authenticationProviders.length
        ? external.authenticationProviders
        : employee.authenticationProviders || ['local'],
      localUser: employee,
    };
  });
  for (const external of auth0Users) {
    if (linked.has(external.id)) continue;
    rows.push({
      ...external,
      id: `auth0:${external.id}`,
      dni: '',
      stationId: '',
    });
  }
  return rows;
}

export function filterUserDirectory(
  rows: DirectoryEntry[],
  actor: Employee,
  filters: { role: string; stationId: string; status: string; search: string },
) {
  return rows.filter(
    (row) =>
      row.localUser?.id !== actor.id &&
      (!filters.role || row.localUser?.roleId === filters.role) &&
      (!filters.stationId || row.stationId === filters.stationId) &&
      hasStationAccess(actor, row.stationId) &&
      (filters.status === 'all' ||
        (filters.status === 'active') === row.active) &&
      `${fullName(row)} ${row.email} ${row.dni}`
        .toLowerCase()
        .includes(filters.search.trim().toLowerCase()),
  );
}
