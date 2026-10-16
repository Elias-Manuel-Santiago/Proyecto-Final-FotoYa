import { StyleSheet } from 'react-native';

export const colors = {
  background: '#f7f7f7',
  surface: '#ffffff',
  text: '#202020',
  muted: '#595959',
  border: '#d2d2d2',
  primary: '#573512',
  accent: '#fff0df',
  lavender: '#efebf8',
  error: '#a21d21',
  success: '#206136',
};

export const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.background },
  content: {
    padding: 16,
    gap: 16,
    width: '100%',
    maxWidth: 960,
    alignSelf: 'center',
    paddingBottom: 40,
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
    borderRadius: 6,
  },
  error: { fontSize: 15, color: colors.error },
  success: { fontSize: 15, color: colors.success },
  label: { fontSize: 15, fontWeight: '600', color: colors.text },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 4,
    padding: 12,
    color: colors.text,
    backgroundColor: colors.surface,
    fontSize: 16,
  },
});
