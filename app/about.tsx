import { StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { radius } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { BrandLogo } from '@/components/BrandLogo';

export default function AboutScreen() {
  const { theme } = useTheme();
  return <Screen contentStyle={styles.content}><AppHeader title="About MamaCare" back />
    <View style={[styles.brand, { backgroundColor: '#FEFEFC', borderColor: theme.border }]}><BrandLogo style={styles.logo} /></View>
    <View style={[styles.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}><Ionicons name="sparkles-outline" size={23} color={theme.primary} /><Text style={[styles.description, { color: theme.textSecondary }]}>A simple personal reminder app designed to help keep daily vitamin schedules organized.</Text></View>
    <View style={[styles.developer, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
      <View style={styles.developerHeading}><View style={[styles.developerIcon, { backgroundColor: theme.primarySoft }]}><Ionicons name="person-outline" size={20} color={theme.primaryStrong} /></View><Text style={[styles.developerLabel, { color: theme.textSecondary }]}>DEVELOPER</Text></View>
      <Text style={[styles.developerName, { color: theme.text }]}>Rey C. Maghilom</Text>
      <Text style={[styles.developerDescription, { color: theme.textSecondary }]}>Developed by Rey C. Maghilom for his wife as a personal tool to help her stay on track with her daily vitamin reminders during pregnancy.</Text>
      <Text style={[styles.careNote, { color: theme.muted }]}>Made with care for my wife and our growing family.</Text>
    </View>
    <Text style={[styles.version, { color: theme.muted }]}>Version 1.0.0</Text>
    <View style={[styles.boundary, { backgroundColor: theme.primarySoft }]}><Ionicons name="shield-checkmark-outline" size={25} color={theme.primaryStrong} /><Text style={[styles.boundaryText, { color: theme.text }]}>MamaCare is a reminder and intake tracking tool. It does not diagnose conditions or recommend treatment.</Text></View>
  </Screen>;
}
const styles = StyleSheet.create({ content: { paddingBottom: 32 }, brand: { minHeight: 292, borderWidth: 1, borderRadius: radius.xl, alignItems: 'center', justifyContent: 'center', padding: 12, marginTop: 12, overflow: 'hidden' }, logo: { width: '100%', height: 260 }, card: { borderWidth: 1, borderRadius: radius.xl, padding: 22, alignItems: 'center', marginTop: 14 }, description: { fontSize: 14, lineHeight: 22, textAlign: 'center', marginTop: 12 }, developer: { borderWidth: 1, borderRadius: radius.xl, padding: 20, marginTop: 14 }, developerHeading: { flexDirection: 'row', alignItems: 'center', gap: 10 }, developerIcon: { width: 36, height: 36, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }, developerLabel: { fontSize: 10, fontWeight: '800', letterSpacing: 1.1 }, developerName: { fontSize: 18, fontWeight: '800', marginTop: 16 }, developerDescription: { fontSize: 13, lineHeight: 21, marginTop: 8 }, careNote: { fontSize: 11, lineHeight: 17, fontStyle: 'italic', marginTop: 13 }, version: { fontSize: 10, fontWeight: '700', letterSpacing: 0.6, textAlign: 'center', marginTop: 16 }, boundary: { borderRadius: radius.lg, padding: 17, flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 }, boundaryText: { flex: 1, fontSize: 12, lineHeight: 18 } });
