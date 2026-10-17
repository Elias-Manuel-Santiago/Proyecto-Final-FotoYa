import { useState } from 'react';
import { Image, Modal, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button } from '../../../components/ui/Button';
import { styles } from '../../../components/ui/theme';
import { useWorkspace } from '../../../providers/AppProvider';
import { errorMessage } from '../../../domain/format';

export function PhotoPreview({
  uri: localUri,
  photoId,
  name,
}: {
  uri?: string;
  photoId?: string;
  name: string;
}) {
  const { repository } = useWorkspace();
  const [uri, setUri] = useState(localUri);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [visible, setVisible] = useState(false);
  const [failed, setFailed] = useState(false);
  return (
    <>
      <Button
        title={`Ver ${name}`}
        secondary
        busy={busy}
        onPress={() => {
          setFailed(false);
          setError('');
          if (!photoId) {
            setUri(localUri);
            setVisible(true);
            return;
          }
          setBusy(true);
          void repository
            .accessPhoto(photoId)
            .then((result) => {
              setUri(result.url);
              setVisible(true);
            })
            .catch((cause: unknown) => setError(errorMessage(cause)))
            .finally(() => setBusy(false));
        }}
      />
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
          <Button title="Cerrar foto" onPress={() => setVisible(false)} />
        </SafeAreaView>
      </Modal>
    </>
  );
}
