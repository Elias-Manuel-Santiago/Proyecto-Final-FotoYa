/**
 * @file
 * Presenta estados y acciones de la cola. Delega selección, envío y limpieza en el hook de la
 * pantalla.
 */
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Button } from '../../../components/ui/Button';
import { Feedback } from '../../../components/ui/Feedback';
import { Icon } from '../../../components/ui/Icon';
import { useTheme } from '../../../components/ui/theme';
import { usePhotoQueue } from '../hooks/usePhotoQueue';
import { PhotoPreview } from './PhotoPreview';

const statusLabels = {
  selected: 'Seleccionada',
  done: 'Cargada en el servidor',
  error: 'Error de carga',
};

// Presenta estados individuales y conecta selección, reintento y limpieza de archivos.
export function UploadQueue() {
  const { styles, colors } = useTheme();
  const { queue, action, select, upload, remove, clearDone } = usePhotoQueue();
  const pending = queue.filter((row) => row.status !== 'done').length;
  return (
    <View style={styles.card}>
      <Text style={styles.heading}>Cargar fotos</Text>
      <Text style={styles.muted}>
        JPG, PNG o WebP, hasta 6 MiB por foto. Cada carga confirmada suma al
        conteo del día. Podés asignar el cliente después de cargarla.
      </Text>
      <Button title="Seleccionar fotos" onPress={select} busy={action.busy} />
      <Feedback error={action.error} success={action.success} />
      <View style={queueStyles.grid}>
        {queue.map((row) => (
          <View key={row.key} style={[styles.card, queueStyles.item]}>
            <Text style={styles.text} numberOfLines={2}>
              {row.name}
            </Text>
            <Text style={styles.muted}>{statusLabels[row.status]}</Text>
            <Feedback error={row.error} />
            <View>
              <PhotoPreview
                uri={row.uri}
                name={row.name}
                showOpenButton={false}
              />
              {row.status !== 'done' && (
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel={`Quitar ${row.name}`}
                  accessibilityState={{ disabled: action.busy }}
                  disabled={action.busy}
                  onPress={() => remove(row.key)}
                  style={({ pressed }) => [
                    queueStyles.remove,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.error,
                      opacity: action.busy ? 0.5 : pressed ? 0.75 : 1,
                    },
                  ]}
                >
                  <Icon name="borrar" color={colors.error} />
                </Pressable>
              )}
            </View>
          </View>
        ))}
      </View>
      {pending > 0 && (
        <Button
          title={`Cargar ${pending} fotos`}
          busy={action.busy}
          onPress={upload}
        />
      )}
      {queue.some((row) => row.status === 'done') && (
        <Button
          title="Limpiar cargas completadas"
          secondary
          disabled={action.busy}
          onPress={clearDone}
        />
      )}
    </View>
  );
}

const queueStyles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'flex-start',
    gap: 12,
  },
  item: {
    flexBasis: 220,
    flexGrow: 1,
    flexShrink: 1,
    maxWidth: 280,
    minWidth: 0,
  },
  remove: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
