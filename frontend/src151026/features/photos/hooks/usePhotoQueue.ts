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

export function usePhotoQueue() {
  const { employee, repository, refresh } = useWorkspace();
  const [queue, setQueue] = useState<QueuedPhoto[]>([]);
  const action = useAction();

  function select() {
    void action.run(async () => {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/jpeg', 'image/png', 'image/webp'],
        multiple: true,
        copyToCacheDirectory: true,
      });
      if (result.canceled) return;
      const selected: QueuedPhoto[] = result.assets.map((asset) => ({
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

  function upload() {
    void action.run(async () => {
      const pending = queue.filter((row) => row.status !== 'done');
      if (!pending.length) return;
      const results = await repository.uploadPhotos(
        employee.id,
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
