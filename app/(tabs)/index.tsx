import { useCallback, useEffect, useRef } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { ProgressCard } from '@/components/ProgressCard';
import { VitaminReminderCard } from '@/components/VitaminReminderCard';
import { SectionHeader } from '@/components/SectionHeader';
import { useAppStore } from '@/store/useAppStore';
import { useTheme } from '@/hooks/useTheme';
import { dateKey, greeting } from '@/utils/date';
import { spacing } from '@/constants/theme';

export default function HomeScreen() {
  const { theme } = useTheme();
  const reminders = useAppStore((state) => state.todayReminders);
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
  const active = reminders.filter((item) => item.status !== 'disabled');
  return <Screen contentStyle={styles.content}>
    <View style={styles.hero}>
      <View style={styles.heroCopy}><Text style={[styles.brand, { color: theme.primaryStrong }]}>MAMACARE · DAILY CARE</Text><Text style={[styles.greeting, { color: theme.text }]}>{greeting()}</Text><Text style={[styles.subtitle, { color: theme.textSecondary }]}>A calm check-in for today&apos;s vitamins.</Text></View>
      <View style={[styles.heroMark, { backgroundColor: theme.primarySoft }]}><Ionicons name="heart" size={27} color={theme.primary} /><Ionicons name="leaf" size={17} color={theme.primaryStrong} style={styles.leaf} /></View>
    </View>
    <ProgressCard reminders={reminders} />
    <SectionHeader title="Today&apos;s timeline" detail={`${active.filter((item) => item.status === 'taken').length}/${active.length} complete`} />
    {reminders.map((reminder) => <VitaminReminderCard key={reminder.id} reminder={reminder} showToggle />)}
    <View style={[styles.note, { backgroundColor: theme.primarySoft }]}><Ionicons name="shield-checkmark-outline" size={20} color={theme.primaryStrong} /><Text style={[styles.noteText, { color: theme.textSecondary }]}>Follow your OB&apos;s prescribed vitamin instructions.</Text></View>
  </Screen>;
}
const styles = StyleSheet.create({ content: { paddingTop: 8 }, hero: { minHeight: 148, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, heroCopy: { flex: 1, paddingRight: 12 }, brand: { fontSize: 9, fontWeight: '800', letterSpacing: 1.3, marginBottom: 8 }, greeting: { fontSize: 27, lineHeight: 34, fontWeight: '800', maxWidth: 250, letterSpacing: -0.5 }, subtitle: { fontSize: 13, lineHeight: 19, marginTop: 7 }, heroMark: { width: 78, height: 78, borderRadius: 25, alignItems: 'center', justifyContent: 'center' }, leaf: { position: 'absolute', right: 11, top: 10 }, note: { borderRadius: 18, padding: spacing.md, flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8, marginBottom: 4 }, noteText: { flex: 1, fontSize: 12, lineHeight: 18 } });
