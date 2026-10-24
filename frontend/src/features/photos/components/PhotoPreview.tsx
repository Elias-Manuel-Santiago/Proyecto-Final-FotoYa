/**
 * @file
 * Solicita una URL temporal al abrir una foto autorizada. Mantiene carga, resultado y error de
 * la previsualización en el componente.
 */
import { useEffect, useState, type ReactNode } from 'react';
import { Image, Modal, Pressable, Text, View, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../../components/ui/Button';
import { useTheme } from '../../../components/ui/theme';
import { useWorkspace } from '../../../providers/AppProvider';
import { errorMessage } from '../../../domain/format';

// Gestiona miniatura y modal con URLs temporales obtenidas por la API autorizada.
export function PhotoPreview({
  uri: localUri,
  photoId,
  saleId,
  name,
  children,
  showOpenButton = true,
}: {
  uri?: string;
  photoId?: string;
  saleId?: string;
  name: string;
  children?: ReactNode | ((close: () => void) => ReactNode);
  showOpenButton?: boolean;
}) {
  const { styles } = useTheme();
  const { repository } = useWorkspace();
  const [uri, setUri] = useState(localUri);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    if (!photoId) return;
    void (
      saleId
        ? repository.accessSoldPhoto(saleId, photoId)
        : repository.accessPhoto(photoId)
    )
      .then((result) => {
        if (active) {
          setUri(result.url);
          setError('');
          setFailed(false);
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(errorMessage(cause));
      });
    return () => {
      active = false;
    };
  }, [repository, photoId, saleId, retry]);
  // Abre la imagen local o pide una URL renovada antes de mostrar la foto remota.
  const open = () => {
    setFailed(false);
    setError('');
    if (!photoId) {
      setUri(localUri);
      setVisible(true);
      return;
    }
    setBusy(true);
    void (
      saleId
        ? repository.accessSoldPhoto(saleId, photoId)
        : repository.accessPhoto(photoId)
    )
      .then((result) => {
        setUri(result.url);
        setVisible(true);
      })
      .catch((cause: unknown) => setError(errorMessage(cause)))
      .finally(() => setBusy(false));
  };
  return (
    <>
      <Pressable
        disabled={busy}
        accessibilityRole="button"
        accessibilityLabel={`Abrir ${name}`}
        onPress={open}
      >
        {!!uri && !failed ? (
          <Image
            source={{ uri }}
            accessibilityLabel={name}
            resizeMode="contain"
            style={{ width: '100%', height: 220 }}
            onError={() => setFailed(true)}
          />
        ) : (
          <Text style={styles.muted}>
            {error ||
              (failed
                ? 'No se pudo cargar la vista previa.'
                : 'Cargando vista previa…')}
          </Text>
        )}
      </Pressable>
      {(!!error || failed) && (
        <Button
          title="Recargar vista previa"
          secondary
          onPress={() => setRetry((value) => value + 1)}
        />
      )}
      {showOpenButton && (
        <Button title={`Ver ${name}`} secondary busy={busy} onPress={open} />
      )}
      {!!error && <Text style={styles.error}>{error}</Text>}
      <Modal
        visible={visible}
        animationType="slide"
        onRequestClose={() => setVisible(false)}
      >
        <SafeAreaView style={[styles.page, { padding: 16, gap: 12 }]}>
          <Text style={styles.heading}>{name}</Text>
          <View style={{ flex: 1 }}>
            {failed ? (
              <Text style={styles.error}>No se pudo mostrar la imagen.</Text>
            ) : (
              <Image
                accessibilityLabel={name}
                source={{ uri }}
                resizeMode="contain"
                style={{ flex: 1 }}
                onError={() => setFailed(true)}
              />
            )}
          </View>
          {!!children && (
            <ScrollView
              style={{ maxHeight: 300 }}
              contentContainerStyle={{ gap: 12 }}
            >
              {typeof children === 'function'
                ? children(() => setVisible(false))
                : children}
            </ScrollView>
          )}
          <Button title="Cerrar foto" onPress={() => setVisible(false)} />
        </SafeAreaView>
      </Modal>
    </>
  );
}
