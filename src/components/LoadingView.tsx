import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

export function LoadingView({ error }: { error?: string | null }) {
  const { theme } = useTheme();
  return <View style={[styles.wrap, { backgroundColor: theme.background }]}>{error ? <Text style={[styles.error, { color: theme.text }]}>{error}</Text> : <><ActivityIndicator size="large" color={theme.primary} /><Text style={[styles.text, { color: theme.textSecondary }]}>Preparing MamaCare...</Text></>}</View>;
}
const styles = StyleSheet.create({ wrap: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 28 }, text: { marginTop: 14, fontSize: 14 }, error: { textAlign: 'center', fontSize: 15, lineHeight: 22 } });
