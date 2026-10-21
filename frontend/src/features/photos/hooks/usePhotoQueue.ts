/**
 * @file
 * Mantiene archivos con UUID y estado individual. Reenvía pendientes/errores y marca done tras
 * la confirmación del servidor.
 */
import { useState } from 'react';
import * as DocumentPicker from 'expo-document-picker';
import { randomUUID } from 'expo-crypto';
import type { PhotoFile } from '../../../domain/models';
import { useAction } from '../../../hooks/useAction';
import { useWorkspace } from '../../../providers/AppProvider';

export interface QueuedPhoto extends PhotoFile {
  status: 'selected' | 'done' | 'error';
  error?: string;
}

// Mantiene archivos y resultados individuales durante la carga de fotos del puesto.
export function usePhotoQueue() {
  const { employee, repository, refresh } = useWorkspace();
  const [queue, setQueue] = useState<QueuedPhoto[]>([]);
  const action = useAction();

  // Agrega archivos con UUID estable evitando repetir la misma selección por URI y nombre.
  function select() {
    void action.run(async () => {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/png', 'image/webp'],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const selected: QueuedPhoto[] = result.assets.map((asset) => ({
        // Esta clave se conserva al reintentar: el servidor reconoce una carga ya confirmada.
        key: randomUUID(),
        name: asset.name,
        uri: asset.uri,
        mimeType: asset.mimeType,
        size: asset.size,
        file: asset.file,
        status: 'selected',
      }));
      setQueue((current) => {
        const merged = [...current];
        selected.forEach((item) => {
          if (
            !merged.some(
              (row) => row.uri === item.uri && row.name === item.name,
            )
          )
            merged.push(item);
        });
        return merged;
      });
    });
  }

  // Reenvía pendientes o fallidos y marca cada archivo según la confirmación del servidor.
  function upload() {
    void action.run(async () => {
      // Las cargas confirmadas no se reenvían; los errores conservan archivo y UUID.
      const pending = queue.filter((row) => row.status !== 'done');
      if (!pending.length) return;
      const results = await repository.uploadPhotos(
        employee.stationId,
        pending,
      );
      setQueue((current) =>
        current.map((row) => {
          const result = results.find((item) => item.key === row.key);
          return result
            ? {
                ...row,
                status: result.error ? 'error' : 'done',
                error: result.error,
              }
            : row;
        }),
      );
      await refresh();
    }, 'Carga procesada. Revisá el estado de cada archivo.');
  }

  return {
    queue,
    action,
    select,
    upload,
    remove: (key: string) =>
      setQueue((current) => current.filter((row) => row.key !== key)),
    clearDone: () =>
      setQueue((current) => current.filter((row) => row.status !== 'done')),
  };
}
