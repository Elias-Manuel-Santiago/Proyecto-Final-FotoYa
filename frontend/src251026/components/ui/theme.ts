import { createContext, useContext } from 'react';
import { StyleSheet } from 'react-native';

export const lightColors = {
  background: '#ded6d0',
  surface: '#ece3db',
  text: '#211c24',
  muted: '#625568',
  border: '#bcadbf',
  primary: '#a64012',
  brand: '#ff944f',
  accent: '#f4c8a8',
  lavender: '#bcb6dc',
  error: '#a32036',
  success: '#22603c',
};
export type Palette = typeof lightColors;
export const darkColors: Palette = {
  background: '#171419',
  surface: '#242027',
  text: '#eee2d8',
  muted: '#bdafc5',
  border: '#514456',
  primary: '#ff944f',
  brand: '#ff944f',
  accent: '#4c3026',
  lavender: '#49385f',
  error: '#ff94a1',
  success: '#95d4ac',
};
const createStyles = (colors: Palette) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.background },
    content: {
      padding: 16,
      gap: 16,
      width: '100%',
      maxWidth: 1600,
      alignSelf: 'center',
      paddingBottom: 88,
    },
    title: { fontSize: 24, fontWeight: '700', color: colors.text },
    heading: { fontSize: 18, fontWeight: '600', color: colors.text },
    text: { fontSize: 16, color: colors.text },
    muted: { fontSize: 14, color: colors.muted },
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      alignItems: 'center',
    },
    stack: { gap: 12 },
    card: {
      padding: 16,
      gap: 10,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
    },
    error: { fontSize: 15, color: colors.error },
    success: { fontSize: 15, color: colors.success },
    label: { fontSize: 15, fontWeight: '600', color: colors.text },
    input: {
      minHeight: 46,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      padding: 12,
      color: colors.text,
      backgroundColor: colors.surface,
      fontSize: 16,
    },
  });

export const themes = {
  light: { colors: lightColors, styles: createStyles(lightColors) },
  dark: { colors: darkColors, styles: createStyles(darkColors) },
};
export const ThemeContext = createContext({
  ...themes.light,
  mode: 'light' as 'light' | 'dark',
  toggle: () => {},
});
export const useTheme = () => useContext(ThemeContext);
