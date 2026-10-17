import { useEffect, useState, type ReactNode } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { styles } from '../../../components/ui/theme';
import { Button } from '../../../components/ui/Button';
import { errorMessage } from '../../../domain/format';
import { useWorkspace } from '../../../providers/AppProvider';
import type { SalePhoto } from '../../../domain/models';

export function SalePhotoCard({
  photo,
  selected,
  onSelect,
  children,
}: {
  photo: SalePhoto;
  selected: boolean;
  onSelect: () => void;
  children?: ReactNode;
}) {
  const { repository } = useWorkspace();
  const [url, setUrl] = useState('');
  const [error, setError] = useState('');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    let active = true;
    repository
      .accessSalePhoto(photo.id)
      .then((result) => {
        if (active) {
          setUrl(result.url);
          setError('');
        }
      })
      .catch((cause: unknown) => {
        if (active) setError(errorMessage(cause));
      });
    return () => {
      active = false;
    };
  }, [repository, photo.id, retry]);
  return (
    <View style={styles.card}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Seleccionar foto ${photo.id}`}
        accessibilityState={{ selected }}
        onPress={onSelect}
      >
        {url && !error ? (
          <Image
            source={{ uri: url }}
            accessibilityLabel={`Foto ${photo.id}`}
            resizeMode="contain"
            style={{ width: '100%', height: 220 }}
            onError={() =>
              setError('La vista previa venció o no se pudo cargar.')
            }
          />
        ) : (
          <Text style={styles.muted}>{error || 'Cargando vista previa…'}</Text>
        )}
        <Text style={styles.heading}>
          Foto {photo.id}
          {selected ? ' · Seleccionada' : ''}
        </Text>
        {photo.sold && (
          <Text style={styles.muted}>
            Familia ya contabilizada. Más copias suman ingresos.
          </Text>
        )}
      </Pressable>
      {!!error && (
        <Button
          title="Recargar vista previa"
          secondary
          onPress={() => setRetry((value) => value + 1)}
        />
      )}
      {selected && children}
    </View>
  );
}
