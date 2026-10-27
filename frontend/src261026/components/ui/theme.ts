import { createContext, useContext } from 'react';
import { StyleSheet } from 'react-native';

export const lightColors = {
  background: '#f7f9fa',
  surface: '#ffffff',
  text: '#18333d',
  muted: '#526970',
  border: '#d7e2e6',
  primary: '#08758d',
  brand: '#5bbfd6',
  accent: '#e3f3f7',
  lavender: '#e3f3f7',
  error: '#b4233d',
  success: '#24724e',
};
export type Palette = typeof lightColors;
export const darkColors: Palette = {
  background: '#151c20',
  surface: '#202b31',
  text: '#eaf3f6',
  muted: '#a6bac3',
  border: '#3c525d',
  primary: '#7dd5e8',
  brand: '#5bbfd6',
  accent: '#223f49',
  lavender: '#223f49',
  error: '#ff9aab',
  success: '#95d4ac',
};
const createStyles = (colors: Palette) =>
  StyleSheet.create({
    page: { flex: 1, backgroundColor: colors.background },
    content: {
      padding: 16,
      gap: 16,
      width: '100%',
      maxWidth: 1440,
      alignSelf: 'center',
      paddingBottom: 32,
    },
    title: {
      fontSize: 28,
      lineHeight: 36,
      fontWeight: '700',
      color: colors.text,
    },
    heading: {
      fontSize: 18,
      lineHeight: 26,
      fontWeight: '600',
      color: colors.text,
    },
    text: { fontSize: 16, lineHeight: 24, color: colors.text },
    muted: { fontSize: 14, lineHeight: 20, color: colors.muted },
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 10,
      alignItems: 'center',
    },
    stack: { gap: 12 },
    card: {
      padding: 20,
      gap: 12,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 16,
    },
    error: { fontSize: 15, color: colors.error },
    success: { fontSize: 15, color: colors.success },
    label: {
      fontSize: 14,
      lineHeight: 20,
      fontWeight: '600',
      color: colors.text,
    },
    input: {
      minHeight: 48,
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
