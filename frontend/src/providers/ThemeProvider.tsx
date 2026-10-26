import { useSyncExternalStore, useState, type ReactNode } from 'react';
import { Platform, Pressable, View, useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ThemeContext, themes } from '../components/ui/theme';
import { useApp } from './AppProvider';
import { Icon } from '../components/ui/Icon';
function savedTheme(): 'light' | 'dark' | null {
  if (Platform.OS !== 'web' || typeof localStorage === 'undefined') return null;
  try {
    const value = localStorage.getItem('fotoya-theme');
    return value === 'light' || value === 'dark' ? value : null;
  } catch {
    return null;
  }
}
function subscribeTheme(listener: () => void) {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return () => {};
  window.addEventListener('storage', listener);
  return () => window.removeEventListener('storage', listener);
}
export function ThemeProvider({ children }: { children: ReactNode }) {
  const { employee } = useApp();
  const system = useColorScheme();
  const [choice, setChoice] = useState<'light' | 'dark' | null>(null);
  const saved = useSyncExternalStore(subscribeTheme, savedTheme, () => null);
  const mode = choice ?? saved ?? (system === 'dark' ? 'dark' : 'light');
  const insets = useSafeAreaInsets();
  const toggle = () => {
    const next = mode === 'light' ? 'dark' : 'light';
    setChoice(next);
    if (Platform.OS === 'web') {
      try {
        localStorage.setItem('fotoya-theme', next);
      } catch {
        /* Optional persistence. */
      }
    }
  };
  const theme = themes[mode];
  return (
    <ThemeContext.Provider value={{ ...theme, mode, toggle }}>
      <StatusBar style={mode === 'dark' ? 'light' : 'dark'} />
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        {children}
        {!employee && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={`Activar tema ${mode === 'light' ? 'oscuro' : 'claro'}`}
            onPress={toggle}
            style={({ pressed }) => ({
              position: 'absolute',
              bottom: insets.bottom + 24,
              right: insets.right + 24,
              width: 48,
              height: 48,
              borderRadius: 24,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: theme.colors.lavender,
              borderWidth: 1,
              borderColor: theme.colors.border,
              elevation: 6,
              boxShadow: '0 4px 16px #00000030',
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Icon name={mode === 'light' ? 'tema-oscuro' : 'tema-claro'} />
          </Pressable>
        )}
      </View>
    </ThemeContext.Provider>
  );
}
