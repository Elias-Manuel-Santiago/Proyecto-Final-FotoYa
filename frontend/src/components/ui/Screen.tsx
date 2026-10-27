/**
 * @file
 * Proporciona área segura, teclado, scroll y actualización por gesto. La pantalla decide
 * cuándo habilitar refresco durante operaciones.
 */
import { createContext, useContext, type ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from './theme';

export const ScreenLayoutContext = createContext({
  embedded: false,
  bottomNavigation: false,
});

// Organiza encabezado y contenido en el contenedor compartido de las pantallas.
export function Screen({
  title,
  children,
  refreshing = false,
  onRefresh,
  refreshEnabled = true,
  compact = false,
  fullWidth = false,
}: {
  title: string;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  refreshEnabled?: boolean;
  compact?: boolean;
  fullWidth?: boolean;
}) {
  const { colors, styles } = useTheme();
  const { embedded, bottomNavigation } = useContext(ScreenLayoutContext);
  const { width } = useWindowDimensions();
  return (
    <SafeAreaView
      style={styles.page}
      edges={[
        ...(!embedded || bottomNavigation ? (['left'] as const) : []),
        'right',
        ...(!embedded ? (['top'] as const) : []),
        ...(!bottomNavigation ? (['bottom'] as const) : []),
      ]}
    >
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[
            styles.content,
            {
              flexGrow: 1,
              padding: width >= 900 ? 28 : 16,
              paddingTop: width >= 900 ? 28 : 20,
              paddingBottom: embedded ? 32 : 88,
            },
            compact && { maxWidth: 720 },
            fullWidth && {
              maxWidth: undefined,
              padding: 12,
              paddingBottom: embedded ? 32 : 88,
            },
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
