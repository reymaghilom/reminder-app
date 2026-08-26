import { StyleSheet, Text, View } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

export function SectionHeader({ title, detail }: { title: string; detail?: string }) {
  const { theme } = useTheme();
  return <View style={styles.row}><Text style={[styles.title, { color: theme.text }]}>{title}</Text>{detail && <Text style={[styles.detail, { color: theme.textSecondary }]}>{detail}</Text>}</View>;
}
const styles = StyleSheet.create({ row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }, title: { fontSize: 18, fontWeight: '800', letterSpacing: -0.25 }, detail: { fontSize: 11, fontWeight: '600' } });
