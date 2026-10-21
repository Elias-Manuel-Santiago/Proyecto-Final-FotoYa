/**
 * @file
 * Construye el archivo multipart desde File web o URI móvil. El repositorio agrega puesto y
 * cliente opcional al enviar cada foto.
 */
import type { PhotoFile } from '../domain/models';

// Construye multipart desde File/Blob en web o URI y metadatos nativos.
export async function photoForm(file: PhotoFile) {
  const form = new FormData();
  let blob: Blob | undefined = file.file;
  if (!blob) {
    const { Platform } = await import('react-native');
    if (Platform.OS === 'web') blob = await (await fetch(file.uri)).blob();
  }
  if (blob) {
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
