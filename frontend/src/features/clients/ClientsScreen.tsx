import { ResponsiveGrid } from '../../components/ui/ResponsiveGrid';
/**
 * @file
 * Busca clientes por correo/DNI en páginas de veinte. Confirma la baja con un modal e ignora
 * respuestas de búsquedas anteriores.
 */
import { useEffect, useState } from 'react';
import { ActivityIndicator, Modal, Text, View } from 'react-native';
import { useWorkspace } from '../../providers/AppProvider';
import { can } from '../../domain/permissions';
import { errorMessage } from '../../domain/format';
import { Screen } from '../../components/ui/Screen';
import { Button } from '../../components/ui/Button';
import { Field } from '../../components/ui/Field';
import { Feedback, EmptyState } from '../../components/ui/Feedback';
import { useTheme } from '../../components/ui/theme';

interface Client {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  dni: string;
  verified: boolean;
}
// Busca clientes por correo o DNI y administra su baja en una lista paginada.
export function ClientsScreen() {
  const { styles } = useTheme();
  const { repository, employee } = useWorkspace();
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState('');
  const [offset, setOffset] = useState(0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [selected, setSelected] = useState<Client | null>(null);
  const [revision, setRevision] = useState(0);
  const key = JSON.stringify([filter, offset, revision]);
  const [response, setResponse] = useState<{
    key: string;
    clients: Client[];
    hasMore: boolean;
    error?: string;
  }>();
  // Cambiar búsqueda o página oculta resultados anteriores mientras llega la respuesta nueva.
  const current = response?.key === key ? response : undefined;
  const rows = current?.clients ?? [];
  const hasMore = current?.hasMore ?? false;
  const loading = !current;
  useEffect(() => {
    let active = true;
    const [search, requestedOffset] = JSON.parse(key) as [string, number];
    void repository.api
      .post<{ clients: Client[]; hasMore: boolean }>('clients/query', {
        search,
        offset: requestedOffset,
      })
      .then((result) => {
        if (active) setResponse({ ...result, key });
      })
      .catch((cause) => {
        if (active)
          setResponse({
            key,
            clients: [],
            hasMore: false,
            error: errorMessage(cause),
          });
      });
    return () => {
      active = false;
    };
  }, [repository, key]);
  // Da de baja al cliente seleccionado y actualiza la lista al completarse.
  async function deactivate() {
    if (!selected || busy) return;
    setBusy(true);
    setError('');
    try {
      await repository.api.post('clients/deactivate', {
        clientId: String(selected.id),
      });
      setSelected(null);
      if (rows.length === 1 && offset > 0) setOffset(offset - 20);
      else setRevision((value) => value + 1);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setBusy(false);
    }
  }
  return (
    <Screen title="Clientes">
      <Field
        label="Buscar por correo o DNI"
        value={search}
        onChangeText={setSearch}
        autoCapitalize="none"
        maxLength={254}
        editable={!busy}
      />
      <Button
        title="Buscar"
        disabled={busy}
        onPress={() => {
          setOffset(0);
          setFilter(search.trim());
          setRevision((value) => value + 1);
        }}
      />
      <Feedback error={selected ? '' : error || current?.error} />
      {loading ? (
        <ActivityIndicator accessibilityLabel="Cargando clientes" />
      ) : (
        <>
          {!rows.length && !error && !current?.error && <EmptyState />}
          <ResponsiveGrid>
            {rows.map((client) => (
              <View key={client.id} style={styles.card}>
                <Text style={styles.heading}>
                  {client.firstName} {client.lastName}
                </Text>
                <Text style={styles.text}>{client.email}</Text>
                <Text style={styles.text}>DNI: {client.dni}</Text>
                {!client.verified && (
                  <Text style={styles.muted}>
                    Correo pendiente de confirmación
                  </Text>
                )}
                {can(employee, 'clients.manage') && (
                  <Button
                    title="Dar de baja"
                    danger
                    disabled={busy}
                    onPress={() => {
                      setError('');
                      setSelected(client);
                    }}
                  />
                )}
              </View>
            ))}
          </ResponsiveGrid>
        </>
      )}
      <View style={styles.row}>
        <Button
          title="Anterior"
          disabled={loading || busy || offset === 0}
          onPress={() => setOffset(offset - 20)}
        />
        <Text style={styles.text}>Página {offset / 20 + 1}</Text>
        <Button
          title="Siguiente"
          disabled={loading || busy || !hasMore}
          onPress={() => setOffset(offset + 20)}
        />
      </View>
      <Button
        title="Actualizar"
        secondary
        disabled={loading || busy}
        onPress={() => setRevision((value) => value + 1)}
      />
      <Modal
        visible={!!selected}
        transparent
        animationType="fade"
        onRequestClose={() => {
          if (!busy) setSelected(null);
        }}
      >
        <View
          style={{
            flex: 1,
            justifyContent: 'center',
            padding: 24,
            backgroundColor: '#00000088',
          }}
        >
          <View style={styles.card} accessibilityViewIsModal>
            <Text style={styles.heading}>Dar de baja al cliente</Text>
            <Text style={styles.text}>
              ¿Estás seguro de dar de baja a {selected?.firstName}{' '}
              {selected?.lastName} ({selected?.email})? Perderá el acceso a su
              cuenta.
            </Text>
            <Feedback error={error} />
            <Button
              title="Confirmar baja"
              danger
              busy={busy}
              onPress={() => {
                void deactivate();
              }}
            />
            <Button
              title="Cancelar"
              secondary
              disabled={busy}
              onPress={() => {
                setSelected(null);
                setError('');
              }}
            />
          </View>
        </View>
      </Modal>
    </Screen>
  );
}
