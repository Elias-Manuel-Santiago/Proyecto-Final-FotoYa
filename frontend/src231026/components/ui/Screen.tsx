/**
 * @file
 * Proporciona área segura, teclado, scroll y actualización por gesto. La pantalla decide
 * cuándo habilitar refresco durante operaciones.
 */
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from './theme';

// Organiza encabezado y contenido en el contenedor compartido de las pantallas.
export function Screen({
  title,
  children,
  refreshing = false,
  onRefresh,
  refreshEnabled = true,
  compact = false,
}: {
  title: string;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  refreshEnabled?: boolean;
  compact?: boolean;
}) {
  const { colors, styles } = useTheme();
  return (
    <SafeAreaView style={styles.page} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.content,
            { flexGrow: 1 },
            compact && { maxWidth: 640, paddingTop: 76 },
          ]}
          alwaysBounceVertical={!!onRefresh && refreshEnabled}
          refreshControl={
            onRefresh ? (
              <RefreshControl
                refreshing={refreshing}
                enabled={refreshEnabled && !refreshing}
                onRefresh={() => {
                  if (refreshEnabled && !refreshing) onRefresh();
                }}
                colors={[colors.primary]}
                tintColor={colors.primary}
              />
            ) : undefined
          }
        >
          <Text accessibilityRole="header" style={styles.title}>
            {title}
          </Text>
          {children}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
