import { ResponsiveGrid } from '../../components/ui/ResponsiveGrid';
/**
 * @file
 * Lista usuarios del alcance recibido. Expone acciones de alta y detalle según permisos.
 */
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Field } from '../../components/ui/Field';
import { Select } from '../../components/ui/Select';
import { EmptyState, Feedback } from '../../components/ui/Feedback';
import { Button } from '../../components/ui/Button';
import { Screen } from '../../components/ui/Screen';
import { useTheme } from '../../components/ui/theme';
import { errorMessage, fullName } from '../../domain/format';
import type { Auth0User } from '../../domain/models';
import {
  authenticationLabel,
  userDirectory,
} from '../../domain/user-directory';
import { can, hasStationAccess, roleLabels } from '../../domain/permissions';
import { useWorkspace } from '../../providers/AppProvider';

// Filtra empleados visibles y ofrece acceso a detalle y alta según permisos.
export function EmployeesScreen() {
  const { employee } = useWorkspace();
  return <EmployeeDirectory key={`${employee.id}:${employee.roleId}`} />;
}

function EmployeeDirectory() {
  const { styles } = useTheme();
  const { data, employee, repository } = useWorkspace();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const [auth0Users, setAuth0Users] = useState<Auth0User[]>([]);
  const [directoryError, setDirectoryError] = useState('');
  const [directoryLoading, setDirectoryLoading] = useState(
    employee.roleId === 'owner',
  );
  const [reload, setReload] = useState(0);
  const isOwner = employee.roleId === 'owner';
  useEffect(() => {
    if (!isOwner) return;
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout>;
    const started = Date.now();
    const load = async () => {
      try {
        const result = await repository.auth0Users();
        if (cancelled) return;
        if (result.status === 'complete') {
          setAuth0Users(result.users);
          setDirectoryLoading(false);
        } else if (Date.now() - started < 120000) {
          timer = setTimeout(() => void load(), 1500);
        } else {
          throw new Error(
            'Auth0 sigue preparando la lista. Volvé a consultar en unos momentos.',
          );
        }
      } catch (error) {
        if (cancelled) return;
        setDirectoryError(errorMessage(error));
        setDirectoryLoading(false);
      }
    };
    void load();
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [employee.id, isOwner, repository, reload]);
  const rows = userDirectory(data.employees, isOwner ? auth0Users : []).filter(
    (row) =>
      hasStationAccess(employee, row.stationId) &&
      (status === 'all' || (status === 'active') === row.active) &&
      `${fullName(row)} ${row.email} ${row.dni}`
        .toLowerCase()
        .includes(search.trim().toLowerCase()),
  );
  return (
    <Screen title="Usuarios">
      {can(employee, 'employees.manage') && (
        <Link href="/employees/new" style={[styles.card, styles.text]}>
          Alta de usuario
        </Link>
      )}
      {isOwner && (
        <>
          <Button
            title="Actualizar usuarios de Auth0"
            secondary
            busy={directoryLoading}
            onPress={() => {
              setDirectoryLoading(true);
              setDirectoryError('');
              setReload((value) => value + 1);
            }}
          />
          {directoryLoading && (
            <Text style={styles.muted}>
              Cargando usuarios del tenant de Auth0…
            </Text>
          )}
          <Feedback error={directoryError} />
        </>
      )}
      <Field
        label="Buscar por nombre, email o DNI"
        value={search}
        onChangeText={setSearch}
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
      {!rows.length && <EmptyState />}
      <ResponsiveGrid>
        {rows.map((row) => (
          <View style={styles.card} key={row.id}>
            <Text style={styles.heading}>
              {fullName(row).trim() || row.email || 'Sin nombre'}
            </Text>
            <Text style={styles.text}>
              {row.email || 'Sin correo compartido'}
            </Text>
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
            <Text style={styles.muted}>
              {row.active ? 'Activo' : 'Inactivo'}
            </Text>
            {row.localUser && (
              <Link
                href={{
                  pathname: '/employees/[id]',
                  params: { id: row.localUser.id },
                }}
                style={styles.text}
              >
                Ver ficha de {fullName(row)}
              </Link>
            )}
          </View>
        ))}
      </ResponsiveGrid>
    </Screen>
  );
}
