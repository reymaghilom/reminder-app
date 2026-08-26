import { useCallback, useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { VitaminReminderCard } from '@/components/VitaminReminderCard';
import { listIntakesForDate } from '@/database/repositories/intakeLogs';
import { listReminderOccurrencesForDate } from '@/database/repositories/reminderOccurrences';
import { listReminders } from '@/database/repositories/reminders';
import { useTheme } from '@/hooks/useTheme';
import { ReminderWithStatus } from '@/types';
import { dateKey, formatFullDate } from '@/utils/date';
import { combineReminders } from '@/utils/reminderStatus';
import { radius } from '@/constants/theme';
import { useAppStore } from '@/store/useAppStore';

export default function DayDetailsScreen() {
  const { date } = useLocalSearchParams<{ date: string }>();
  const { theme } = useTheme();
  const settings = useAppStore((state) => state.settings);
  const [items, setItems] = useState<ReminderWithStatus[]>([]);
  const load = useCallback(async () => {
    const [reminders, intakes, occurrences] = await Promise.all([
      listReminders(),
      listIntakesForDate(date),
      listReminderOccurrencesForDate(date),
    ]);
    setItems(combineReminders(reminders, intakes, occurrences, date, settings));
  }, [date, settings]);
  useEffect(() => { void load(); }, [load]);
  const completed = items.filter((item) => item.status === 'taken').length;
  const expected = items.filter((item) => item.enabled).length;
  const future = date > dateKey();
  return <Screen contentStyle={styles.content}><AppHeader title="Day Details" back />
    <View style={[styles.dateCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}><View style={[styles.icon, { backgroundColor: theme.primarySoft }]}><Ionicons name="calendar-outline" size={23} color={theme.primaryStrong} /></View><View style={styles.dateCopy}><Text style={[styles.date, { color: theme.text }]}>{formatFullDate(date)}</Text><Text style={[styles.count, { color: theme.textSecondary }]}>{expected} scheduled reminders</Text></View><View><Text style={[styles.completed, { color: theme.text }]}>{completed} of {expected}</Text><Text style={[styles.completeLabel, { color: theme.textSecondary }]}>completed</Text></View></View>
    {items.map((item) => <VitaminReminderCard key={item.id} reminder={item} scheduledDate={date} canTake={!future} onTakenRecorded={() => void load()} />)}
    {future && <View style={[styles.message, { backgroundColor: theme.primarySoft }]}><Ionicons name="information-circle-outline" size={19} color={theme.primaryStrong} /><Text style={[styles.messageText, { color: theme.textSecondary }]}>Future reminders cannot be marked as taken.</Text></View>}
  </Screen>;
}

const styles = StyleSheet.create({ content: { paddingBottom: 32 }, dateCard: { borderWidth: 1, borderRadius: radius.xl, padding: 16, marginBottom: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }, icon: { width: 46, height: 46, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, dateCopy: { flex: 1 }, date: { fontSize: 14, fontWeight: '800' }, count: { fontSize: 11, marginTop: 4 }, completed: { fontSize: 18, fontWeight: '800', textAlign: 'right' }, completeLabel: { fontSize: 9, fontWeight: '600', marginTop: 3 }, message: { padding: 15, borderRadius: radius.lg, flexDirection: 'row', gap: 9 }, messageText: { flex: 1, fontSize: 12, lineHeight: 18 } });
