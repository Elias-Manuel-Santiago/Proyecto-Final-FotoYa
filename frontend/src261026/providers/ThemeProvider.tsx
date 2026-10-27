import { useSyncExternalStore, useState, type ReactNode } from 'react';
import { Platform, View, useColorScheme } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { ThemeContext, themes } from '../components/ui/theme';
import { useApp } from './AppProvider';
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
  const systemMode = system === 'dark' ? 'dark' : 'light';
  const mode = employee ? (choice ?? saved ?? systemMode) : systemMode;
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
      </View>
    </ThemeContext.Provider>
  );
}
