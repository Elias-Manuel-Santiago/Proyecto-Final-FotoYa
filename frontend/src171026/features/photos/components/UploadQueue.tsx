import { Text, View } from 'react-native';
import { Button } from '../../../components/ui/Button';
import { Feedback } from '../../../components/ui/Feedback';
import { styles } from '../../../components/ui/theme';
import { usePhotoQueue } from '../hooks/usePhotoQueue';
import { PhotoPreview } from './PhotoPreview';

const statusLabels = {
  selected: 'Seleccionada',
  done: 'Cargada en el servidor',
  error: 'Error de carga',
};

export function UploadQueue() {
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
      {queue.map((row) => (
        <View key={row.key} style={styles.card}>
          <Text style={styles.text}>
            {row.name} · {statusLabels[row.status]}
          </Text>
          <Feedback error={row.error} />
          <PhotoPreview uri={row.uri} name={row.name} />
          {row.status !== 'done' && (
            <Button
              title={`Quitar ${row.name}`}
              secondary
              disabled={action.busy}
              onPress={() => remove(row.key)}
            />
          )}
        </View>
      ))}
      {pending > 0 && (
        <Button
          title={`Cargar o reintentar ${pending} fotos`}
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
