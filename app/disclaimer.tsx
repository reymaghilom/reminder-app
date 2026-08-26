import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { radius, shadows } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

export default function DisclaimerScreen() {
  const { theme } = useTheme();
  return <Screen contentStyle={styles.content}><AppHeader title="Disclaimer" back />
    <View style={styles.hero}><View style={[styles.icon, { backgroundColor: theme.primarySoft }]}><Ionicons name="shield-checkmark-outline" size={40} color={theme.primaryStrong} /></View><Text style={[styles.title, { color: theme.text }]}>Your care stays with your healthcare provider.</Text></View>
    <View style={[styles.card, shadows.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}><Text style={[styles.body, { color: theme.text }]}>MamaCare is a reminder tool only and does not provide medical advice. Follow your OB&apos;s prescribed instructions for your vitamins. For questions or concerns, consult your healthcare provider.</Text></View>
    <View style={[styles.note, { backgroundColor: theme.primarySoft }]}><Ionicons name="information-circle-outline" size={20} color={theme.primaryStrong} /><Text style={[styles.noteText, { color: theme.textSecondary }]}>MamaCare does not change prescribed dosage, suggest medicines, or replace professional medical advice.</Text></View>
  </Screen>;
}
const styles = StyleSheet.create({ content: { paddingBottom: 32 }, hero: { alignItems: 'center', paddingVertical: 34 }, icon: { width: 84, height: 84, borderRadius: 26, alignItems: 'center', justifyContent: 'center' }, title: { maxWidth: 300, textAlign: 'center', fontSize: 21, lineHeight: 29, fontWeight: '800', marginTop: 18 }, card: { borderWidth: 1, borderRadius: radius.xl, padding: 22 }, body: { fontSize: 15, lineHeight: 25 }, note: { borderRadius: radius.lg, padding: 16, flexDirection: 'row', gap: 10, marginTop: 14 }, noteText: { flex: 1, fontSize: 12, lineHeight: 18 } });
