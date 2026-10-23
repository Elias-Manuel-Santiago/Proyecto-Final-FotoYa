import { ResponsiveGrid } from '../../components/ui/ResponsiveGrid';
/**
 * @file
 * Lista usuarios del alcance recibido. Expone acciones de alta y detalle según permisos.
 */
import { Link } from 'expo-router';
import { useState } from 'react';
import { Text, View } from 'react-native';
import { Field } from '../../components/ui/Field';
import { Select } from '../../components/ui/Select';
import { EmptyState } from '../../components/ui/Feedback';
import { Screen } from '../../components/ui/Screen';
import { useTheme } from '../../components/ui/theme';
import { fullName } from '../../domain/format';
import { can, hasStationAccess, roleLabels } from '../../domain/permissions';
import { useWorkspace } from '../../providers/AppProvider';

// Filtra empleados visibles y ofrece acceso a detalle y alta según permisos.
export function EmployeesScreen() {
  const { styles } = useTheme();
  const { data, employee } = useWorkspace();
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('all');
  const rows = data.employees.filter(
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
            <Text style={styles.heading}>{fullName(row)}</Text>
            <Text style={styles.text}>
              {roleLabels[row.roleId]} ·{' '}
              {
                data.stations.find((station) => station.id === row.stationId)
                  ?.name
              }
            </Text>
            <Text style={styles.muted}>
              {row.active ? 'Activo' : 'Inactivo'}
            </Text>
            <Link
              href={{ pathname: '/employees/[id]', params: { id: row.id } }}
              style={styles.text}
            >
              Ver ficha de {fullName(row)}
            </Link>
          </View>
        ))}
      </ResponsiveGrid>
    </Screen>
  );
}
