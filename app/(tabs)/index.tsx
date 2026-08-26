import { useCallback, useEffect, useRef } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Href, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { ProgressCard } from '@/components/ProgressCard';
import { VitaminReminderCard } from '@/components/VitaminReminderCard';
import { SectionHeader } from '@/components/SectionHeader';
import { useAppStore } from '@/store/useAppStore';
import { useTheme } from '@/hooks/useTheme';
import { dateKey, greeting } from '@/utils/date';
import { radius, shadows, spacing } from '@/constants/theme';

export default function HomeScreen() {
  const { theme } = useTheme();
  const reminders = useAppStore((state) => state.todayReminders);
  const vitamins = useAppStore((state) => state.vitamins);
  const refresh = useAppStore((state) => state.refresh);
  const refreshTodayStatuses = useAppStore((state) => state.refreshTodayStatuses);
  const loadedDay = useRef(dateKey());
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const scheduleMinuteRefresh = () => {
      const delay = 60_050 - (Date.now() % 60_000);
      timer = setTimeout(() => {
        const today = dateKey();
        if (today !== loadedDay.current) {
          loadedDay.current = today;
          void refresh();
        } else {
          refreshTodayStatuses();
        }
        scheduleMinuteRefresh();
      }, delay);
    };
    scheduleMinuteRefresh();
    return () => clearTimeout(timer);
  }, [refresh, refreshTodayStatuses]);
  const active = reminders.filter((item) => item.enabled);
  return <Screen contentStyle={styles.content}>
    <View style={styles.hero}>
      <View style={styles.heroCopy}><Text style={[styles.brand, { color: theme.primaryStrong }]}>REMINDER APP · DAILY CARE</Text><Text style={[styles.greeting, { color: theme.text }]}>{greeting()}</Text><Text style={[styles.subtitle, { color: theme.textSecondary }]}>Your daily vitamin and supplement reminders.</Text></View>
      <View style={[styles.heroMark, { backgroundColor: theme.primarySoft }]}><Ionicons name="heart" size={27} color={theme.primary} /><Ionicons name="leaf" size={17} color={theme.primaryStrong} style={styles.leaf} /></View>
    </View>
    {vitamins.length === 0 ? <View style={[styles.empty, shadows.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}><View style={[styles.emptyIcon, { backgroundColor: theme.primarySoft }]}><Ionicons name="medical-outline" size={30} color={theme.primaryStrong} /></View><Text style={[styles.emptyTitle, { color: theme.text }]}>No vitamins added yet</Text><Text style={[styles.emptyText, { color: theme.textSecondary }]}>Add your first vitamin or supplement to start setting up reminders.</Text><Pressable accessibilityRole="button" onPress={() => router.push('/vitamin/new' as Href)} style={({ pressed }) => [styles.emptyAction, { backgroundColor: theme.primary, opacity: pressed ? 0.82 : 1 }]}><Ionicons name="add" size={20} color={theme.white} /><Text style={styles.emptyActionText}>Add Vitamin/Supplement</Text></Pressable></View> : <>
      <ProgressCard reminders={reminders} />
      <SectionHeader title="Today&apos;s timeline" detail={active.length ? `${active.filter((item) => item.status === 'taken').length}/${active.length} complete` : 'No active doses'} />
      {reminders.map((reminder) => <VitaminReminderCard key={reminder.id} reminder={reminder} showToggle />)}
    </>}
    <View style={[styles.note, { backgroundColor: theme.primarySoft }]}><Ionicons name="shield-checkmark-outline" size={20} color={theme.primaryStrong} /><Text style={[styles.noteText, { color: theme.textSecondary }]}>Follow your healthcare professional&apos;s instructions.</Text></View>
  </Screen>;
}
const styles = StyleSheet.create({ content: { paddingTop: 8 }, hero: { minHeight: 148, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, heroCopy: { flex: 1, paddingRight: 12 }, brand: { fontSize: 9, fontWeight: '800', letterSpacing: 1.3, marginBottom: 8 }, greeting: { fontSize: 27, lineHeight: 34, fontWeight: '800', maxWidth: 250, letterSpacing: -0.5 }, subtitle: { fontSize: 13, lineHeight: 19, marginTop: 7 }, heroMark: { width: 78, height: 78, borderRadius: 25, alignItems: 'center', justifyContent: 'center' }, leaf: { position: 'absolute', right: 11, top: 10 }, empty: { borderWidth: 1, borderRadius: radius.xl, padding: 28, alignItems: 'center', marginBottom: 16 }, emptyIcon: { width: 60, height: 60, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }, emptyTitle: { fontSize: 18, fontWeight: '800', marginTop: 14 }, emptyText: { maxWidth: 270, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 6 }, emptyAction: { height: 48, borderRadius: radius.md, paddingHorizontal: 23, marginTop: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, emptyActionText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' }, note: { borderRadius: 18, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, marginBottom: 4 }, noteText: { flex: 1, fontSize: 12, lineHeight: 18 } });
