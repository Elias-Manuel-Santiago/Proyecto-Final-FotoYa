import { Text } from 'react-native';
import { styles } from './theme';

export function Feedback({
  error,
  success,
}: {
  error?: string;
  success?: string;
}) {
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

export function EmptyState({
  message = 'No hay registros para estos filtros.',
}: {
  message?: string;
}) {
  return <Text style={styles.muted}>{message}</Text>;
}
