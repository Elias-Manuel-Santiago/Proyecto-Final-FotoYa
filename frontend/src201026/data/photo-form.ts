import type { PhotoFile } from '../domain/models';

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
