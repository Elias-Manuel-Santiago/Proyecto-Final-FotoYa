/**
 * @file
 * Presenta errores, confirmaciones y estados vacíos. Comparte mensajes sin incorporar reglas
 * de negocio.
 */
import { Text } from 'react-native';
import { useTheme } from './theme';

// Muestra mensajes de error o éxito con el estilo compartido.
export function Feedback({
  error,
  success,
}: {
  error?: string;
  success?: string;
}) {
  const { styles } = useTheme();
  return (
    <>
      {!!error && (
        <Text
          accessibilityRole="alert"
          accessibilityLiveRegion="assertive"
          style={styles.error}
        >
          {error}
        </Text>
      )}
      {!!success && (
        <Text accessibilityLiveRegion="polite" style={styles.success}>
          {success}
        </Text>
      )}
    </>
  );
}

// Explica la ausencia de registros en una lista o consulta.
export function EmptyState({
  message = 'No hay registros para estos filtros.',
}: {
  message?: string;
}) {
  const { styles } = useTheme();
  return <Text style={styles.muted}>{message}</Text>;
}
