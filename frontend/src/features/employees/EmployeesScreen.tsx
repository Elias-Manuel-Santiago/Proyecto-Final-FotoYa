import { ResponsiveGrid } from '../../components/ui/ResponsiveGrid';
/**
 * @file
 * Lista usuarios del alcance recibido. Expone acciones de alta y detalle según permisos.
 */
import { Link } from 'expo-router';
import { useState } from 'react';
import { Text } from 'react-native';
import { Field } from '../../components/ui/Field';
import { Select } from '../../components/ui/Select';
import { FilterSection } from '../../components/filters/FilterSection';
import { EmptyState, Feedback } from '../../components/ui/Feedback';
import { UserCard } from '../../components/ui/UserCard';
import { useAction } from '../../hooks/useAction';
import { Screen } from '../../components/ui/Screen';
import { useTheme } from '../../components/ui/theme';
import { fullName } from '../../domain/format';
import {
  authenticationLabel,
  filterUserDirectory,
  userDirectory,
} from '../../domain/user-directory';
import { can, roleLabels } from '../../domain/permissions';
import { useWorkspace } from '../../providers/AppProvider';
// Filtra empleados visibles y ofrece acceso a detalle y alta según permisos.
export function EmployeesScreen() {
  const { employee } = useWorkspace();
  return <EmployeeDirectory key={`${employee.id}:${employee.roleId}`} />;
}
function EmployeeDirectory() {
  const { styles } = useTheme();
  const { data, employee, auth0Users, directoryError, refresh } =
    useWorkspace();
  const refreshAction = useAction();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [role, setRole] = useState('');
  const [stationId, setStationId] = useState('');
  const isOwner = employee.roleId === 'owner';
  const rows = filterUserDirectory(
    userDirectory(data.employees, isOwner ? auth0Users : []),
    employee,
    { role, stationId, status, search },
  );
  return (
    <Screen
      title="Empleados"
      refreshing={refreshAction.busy}
      onRefresh={() => void refreshAction.run(refresh)}
    >
      <Feedback error={refreshAction.error} />
      {can(employee, 'employees.manage') && (
        <Link href="/employees/new" style={[styles.card, styles.text]}>
          Alta de usuario
        </Link>
      )}
      <Feedback error={directoryError} />
      <FilterSection>
        <Field
          label="Buscar por nombre, email o DNI"
          value={search}
          onChangeText={setSearch}
        />
        <Select
          label="Rol"
          value={role}
          onChange={setRole}
          options={[
            { value: '', label: 'Todos' },
            ...Object.entries(roleLabels)
              .filter(([value]) => value !== 'client')
              .map(([value, label]) => ({ value, label })),
          ]}
        />
        <Select
          label="Puesto"
          value={stationId}
          onChange={setStationId}
          options={[
            { value: '', label: 'Todos' },
            ...data.stations.map((station) => ({
              value: station.id,
              label: station.name,
            })),
          ]}
        />
        <Select
          label="Estado"
          value={status}
          onChange={setStatus}
          options={[
            { value: 'all', label: 'Todos' },
            { value: 'active', label: 'Activos' },
            { value: 'inactive', label: 'Inactivos' },
          ]}
        />
      </FilterSection>
      {!rows.length && <EmptyState />}
      <ResponsiveGrid>
        {rows.map((row) => (
          <UserCard
            key={row.id}
            name={fullName(row).trim() || row.email || 'Sin nombre'}
            email={row.email}
            providers={row.authenticationProviders}
          >
            <Text style={styles.text}>
              {row.localUser
                ? roleLabels[row.localUser.roleId]
                : 'Cuenta Auth0 · Sin registro en Foto Ya'}{' '}
              {row.stationId &&
                data.stations.find((station) => station.id === row.stationId)
                  ?.name}
            </Text>
            <Text style={styles.muted}>
              Autenticación: {authenticationLabel(row.authenticationProviders)}
            </Text>
            {row.authenticationProviders.length > 1 && (
              <Text style={styles.muted}>
                Este correo está registrado en varios servicios.
              </Text>
            )}
            <Text style={styles.muted}>
              {row.active ? 'Activo' : 'Inactivo'}
            </Text>
            {(row.accounts ?? [row])
              .filter((account) => account.localUser)
              .map((account) => (
                <Link
                  key={account.id}
                  href={{
                    pathname: '/employees/[id]',
                    params: { id: account.localUser!.id },
                  }}
                  style={styles.text}
                >
                  Ver ficha de {fullName(account)}
                </Link>
              ))}
          </UserCard>
        ))}
      </ResponsiveGrid>
    </Screen>
  );
}
