import { File, Paths } from 'expo-file-system';
import { isAvailableAsync, shareAsync } from 'expo-sharing';

export async function downloadCsv(filename: string, content: string) {
  if (!(await isAvailableAsync()))
    throw new Error(
      'Este dispositivo no permite guardar o compartir archivos.',
    );
  const file = new File(Paths.cache, filename);
  await file.write(content);
  await shareAsync(file.uri, {
    mimeType: 'text/csv',
    UTI: 'public.comma-separated-values-text',
    dialogTitle: 'Guardar horarios para Excel',
  });
}
