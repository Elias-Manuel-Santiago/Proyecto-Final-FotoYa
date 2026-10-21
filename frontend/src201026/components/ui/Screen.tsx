import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  ScrollView,
  Text,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors, styles } from './theme';

export function Screen({
  title,
  children,
  refreshing = false,
  onRefresh,
  refreshEnabled = true,
}: {
  title: string;
  children: ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  refreshEnabled?: boolean;
}) {
  return (
    <SafeAreaView style={styles.page} edges={['left', 'right', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={[styles.content, { flexGrow: 1 }]}
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
