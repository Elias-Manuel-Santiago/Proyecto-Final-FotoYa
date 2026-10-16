import { Platform } from 'react-native';
import type { PhotoFile } from '../domain/models';

export async function photoForm(file: PhotoFile) {
  const form = new FormData();
  if (Platform.OS === 'web') {
    const blob = file.file ?? (await (await fetch(file.uri)).blob());
    form.append('photo', blob, file.name);
  } else {
    // React Native serializa descriptores URI como archivos multipart.
    form.append('photo', {
      uri: file.uri,
      name: file.name,
      type:
        file.mimeType ??
        {
          jpg: 'image/jpeg',
          jpeg: 'image/jpeg',
          png: 'image/png',
          webp: 'image/webp',
        }[file.name.split('.').pop()?.toLowerCase() ?? ''] ??
        'application/octet-stream',
    } as unknown as Blob);
  }
  return form;
}
