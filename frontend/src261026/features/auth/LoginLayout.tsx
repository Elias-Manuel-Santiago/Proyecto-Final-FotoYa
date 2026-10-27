import { Image } from 'expo-image';
import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '../../components/ui/theme';

export function LoginLayout({ children }: { children: ReactNode }) {
  const { width } = useWindowDimensions();
  const wide = width >= 900;
  const { colors, mode } = useTheme();
  return (
    <View
      style={{
        flex: 1,
        flexDirection: 'row',
        backgroundColor: colors.background,
      }}
    >
      <Image
        source={require('../../../assets/images/foto-login.jpeg')}
        contentFit="cover"
        contentPosition={{ left: '50%', top: '38%' }}
        blurRadius={wide ? 0 : 12}
        style={
          wide ? { width: '40%', height: '100%' } : StyleSheet.absoluteFill
        }
      />
      {!wide && (
        <View
          pointerEvents="none"
          style={[
            StyleSheet.absoluteFill,
            { backgroundColor: mode === 'dark' ? '#151c2088' : '#f7f9fa66' },
          ]}
        />
      )}
      <SafeAreaView style={{ flex: 1, minWidth: 0 }}>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={{
              flexGrow: 1,
              justifyContent: 'center',
              padding: wide ? 48 : 16,
              paddingBottom: wide ? 48 : 88,
            }}
          >
            <View
              style={{
                width: '100%',
                maxWidth: wide ? 420 : 480,
                alignSelf: 'center',
                gap: 16,
                padding: wide ? 0 : 24,
                borderRadius: 24,
                backgroundColor: wide ? 'transparent' : colors.background,
              }}
            >
              <Image
                source={require('../../../assets/images/ui-svg/foto-ya-logo-texto.png')}
                accessibilityLabel="Foto Ya"
                contentFit="contain"
                style={{
                  width: '100%',
                  maxWidth: 240,
                  height: 102,
                  alignSelf: 'center',
                  marginBottom: 16,
                }}
              />
              {children}
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}
