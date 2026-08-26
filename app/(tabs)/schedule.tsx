import { useCallback, useMemo } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Href, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { VitaminIcon } from '@/components/VitaminIcon';
import { useAppStore } from '@/store/useAppStore';
import { useTheme } from '@/hooks/useTheme';
import { formatTime } from '@/utils/time';
import { scheduleLabel } from '@/utils/scheduleLabel';
import { radius, shadows, spacing } from '@/constants/theme';
import { AppSwitch } from '@/components/AppSwitch';

export default function ScheduleScreen() {
  const { theme } = useTheme();
  const vitamins = useAppStore((state) => state.vitamins);
  const reminders = useAppStore((state) => state.reminders);
  const refresh = useAppStore((state) => state.refresh);
  const toggleReminder = useAppStore((state) => state.toggleReminder);
  const updatingReminderIds = useAppStore((state) => state.updatingReminderIds);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const grouped = useMemo(() => vitamins.map((vitamin) => ({
    vitamin,
    doses: reminders.filter((item) => item.vitaminId === vitamin.id).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
  })).filter((group) => group.doses.length), [reminders, vitamins]);

  const toggle = async (id: number, enabled: boolean) => {
    try {
      const result = await toggleReminder(id, enabled);
      if (!result.notificationsSynchronized) Alert.alert('Reminder updated', 'The reminder was updated, but notifications could not be synchronized. Reminder App will repair them the next time it starts.');
    } catch (error) {
      if (__DEV__) console.warn('Reminder toggle failed', error);
      Alert.alert('Unable to update', 'Unable to update this reminder. Please try again.');
    }
  };

  return <Screen contentStyle={styles.content}>
    <AppHeader title="Vitamin Schedule" right={<Ionicons name="calendar-outline" size={24} color={theme.text} />} />
    <View style={[styles.info, { backgroundColor: theme.primarySoft, borderColor: theme.border }]}><Ionicons name="information-circle-outline" size={24} color={theme.primaryStrong} /><View style={styles.infoCopy}><Text style={[styles.infoText, { color: theme.text }]}>Your daily reminder schedule</Text><Text style={[styles.infoSub, { color: theme.textSecondary }]}>Set it according to your healthcare professional&apos;s instructions.</Text></View></View>
    {grouped.length > 0 && <Pressable accessibilityRole="button" onPress={() => router.push('/vitamin/new' as Href)} style={({ pressed }) => [styles.add, { backgroundColor: theme.primary, opacity: pressed ? 0.82 : 1 }]}><Ionicons name="add" size={21} color={theme.white} /><Text style={styles.addText}>Add Vitamin/Supplement</Text></Pressable>}

    {grouped.map(({ vitamin, doses }) => {
      return <View key={vitamin.id} style={styles.group}>
        <View style={styles.groupHead}><VitaminIcon vitaminKey={vitamin.vitaminKey} size={44} /><View style={styles.groupCopy}><Text style={[styles.groupTitle, { color: theme.text }]}>{vitamin.name}</Text>{Boolean(vitamin.brand || vitamin.description) && <Text style={[styles.groupMeta, { color: theme.textSecondary }]}>{[vitamin.brand, vitamin.description].filter(Boolean).join(' · ')}</Text>}<Text style={[styles.frequency, { color: theme.textSecondary }]}>{doses.length} {doses.length === 1 ? 'dose' : 'doses'} daily</Text></View><Pressable accessibilityLabel={`Edit ${vitamin.name}`} onPress={() => router.push(`/vitamin/${vitamin.id}` as Href)} style={({ pressed }) => [styles.editVitamin, { backgroundColor: pressed ? theme.primarySoft : theme.input, borderColor: theme.border }]}><Ionicons name="create-outline" size={18} color={theme.primaryStrong} /><Text style={[styles.editVitaminText, { color: theme.primaryStrong }]}>Edit</Text></Pressable></View>
        <View style={[styles.rows, shadows.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>{doses.map((reminder, index) => <Pressable key={reminder.id} disabled={updatingReminderIds.includes(reminder.id)} onPress={() => router.push(`/reminder/${reminder.id}` as Href)} style={({ pressed }) => [styles.row, index < doses.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.divider }, pressed && { backgroundColor: theme.input }]}>
          <View style={[styles.doseDot, { backgroundColor: theme.primarySoft }]}><Ionicons name="medical" size={17} color={theme.primary} /></View>
          <View style={styles.rowCopy}><Text style={[styles.dose, { color: theme.text }]}>{reminder.doseLabel}</Text><Text style={[styles.period, { color: theme.textSecondary }]}>{scheduleLabel(reminder.mealPeriod, reminder.customScheduleLabel)}</Text></View>
          <View style={styles.timeWrap}><Text style={[styles.time, { color: theme.text }]}>{formatTime(reminder.scheduledTime)}</Text><Ionicons name="chevron-forward" size={17} color={theme.muted} /></View>
          <AppSwitch accessibilityLabel={`${reminder.vitaminName} ${reminder.doseLabel} enabled`} value={reminder.enabled} disabled={updatingReminderIds.includes(reminder.id)} onValueChange={(value) => void toggle(reminder.id, value)} />
        </Pressable>)}</View>
      </View>;
    })}
    {!grouped.length && <View style={[styles.empty, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}><View style={[styles.emptyIcon, { backgroundColor: theme.primarySoft }]}><Ionicons name="calendar-outline" size={29} color={theme.primaryStrong} /></View><Text style={[styles.emptyTitle, { color: theme.text }]}>No vitamins added yet</Text><Text style={[styles.emptyText, { color: theme.textSecondary }]}>Add your first vitamin or supplement to start setting up reminders.</Text><Pressable accessibilityRole="button" onPress={() => router.push('/vitamin/new' as Href)} style={({ pressed }) => [styles.emptyAction, { backgroundColor: theme.primary, opacity: pressed ? 0.82 : 1 }]}><Ionicons name="add" size={20} color={theme.white} /><Text style={styles.addText}>Add Vitamin/Supplement</Text></Pressable></View>}
  </Screen>;
}

const styles = StyleSheet.create({
  content: { paddingBottom: 28 },
  info: { borderWidth: 1, borderRadius: radius.lg, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12 },
  infoCopy: { flex: 1 }, infoText: { fontSize: 13, fontWeight: '700' }, infoSub: { fontSize: 11, lineHeight: 16, marginTop: 4 },
  add: { height: 48, borderRadius: radius.lg, marginTop: 12, marginBottom: spacing.xl, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  addText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  group: { marginBottom: 27 }, groupHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 13 },
  groupCopy: { flex: 1, marginLeft: 12 }, groupTitle: { fontSize: 19, fontWeight: '800' }, groupMeta: { fontSize: 11, marginTop: 3 },
  frequency: { fontSize: 11, fontWeight: '700', marginTop: 5, textTransform: 'uppercase', letterSpacing: 0.7 },
  editVitamin: { minHeight: 38, borderWidth: 1, borderRadius: radius.sm, paddingHorizontal: 10, flexDirection: 'row', alignItems: 'center', gap: 4 },
  editVitaminText: { fontSize: 11, fontWeight: '800' }, rows: { borderWidth: 1, borderRadius: radius.xl, overflow: 'hidden' },
  row: { minHeight: 90, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10 },
  doseDot: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, rowCopy: { flex: 1 },
  dose: { fontSize: 14, fontWeight: '800' }, period: { fontSize: 11, marginTop: 5 }, timeWrap: { flexDirection: 'row', alignItems: 'center', gap: 1 },
  time: { fontSize: 14, fontWeight: '800' }, empty: { borderWidth: 1, borderRadius: radius.xl, padding: 28, alignItems: 'center' },
  emptyIcon: { width: 58, height: 58, borderRadius: 20, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 17, fontWeight: '800', marginTop: 13 }, emptyText: { maxWidth: 270, fontSize: 12, lineHeight: 18, textAlign: 'center', marginTop: 6 },
  emptyAction: { height: 46, borderRadius: radius.md, paddingHorizontal: 22, marginTop: 17, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 },
});
