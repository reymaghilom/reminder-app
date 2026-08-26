import { useCallback } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { Href, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { VitaminIcon } from '@/components/VitaminIcon';
import { useAppStore } from '@/store/useAppStore';
import { useTheme } from '@/hooks/useTheme';
import { formatTime } from '@/utils/time';
import { radius, shadows, spacing } from '@/constants/theme';
import { AppSwitch } from '@/components/AppSwitch';

export default function ScheduleScreen() {
  const { theme } = useTheme();
  const reminders = useAppStore((state) => state.reminders);
  const refresh = useAppStore((state) => state.refresh);
  const toggleReminder = useAppStore((state) => state.toggleReminder);
  const updatingReminderIds = useAppStore((state) => state.updatingReminderIds);
  useFocusEffect(useCallback(() => { void refresh(); }, [refresh]));
  const groups = ['calciumade', 'heme_up_fa'] as const;
  const toggle = async (id: number, enabled: boolean) => {
    try {
      const result = await toggleReminder(id, enabled);
      if (!result.notificationsSynchronized) Alert.alert(
        'Reminder updated',
        'The reminder was updated, but notifications could not be synchronized. MamaCare will repair them the next time it starts.',
      );
    } catch (error) {
      if (__DEV__) console.warn('Reminder toggle failed', error);
      Alert.alert('Unable to update', 'Unable to update this reminder. Please try again.');
    }
  };
  return <Screen contentStyle={styles.content}>
    <AppHeader title="Vitamin Schedule" right={<Ionicons name="information-circle-outline" size={25} color={theme.text} />} />
    <View style={[styles.info, { backgroundColor: theme.primarySoft, borderColor: theme.border }]}><Ionicons name="calendar-outline" size={24} color={theme.primaryStrong} /><View><Text style={[styles.infoText, { color: theme.text }]}>Set your vitamin reminder times.</Text><Text style={[styles.infoSub, { color: theme.textSecondary }]}>Follow your OB&apos;s instructions.</Text></View></View>
    {groups.map((key) => {
      const group = reminders.filter((item) => item.vitaminKey === key); if (!group.length) return null;
      const first = group[0];
      return <View key={key} style={styles.group}>
        <View style={styles.groupHead}><VitaminIcon vitaminKey={key} size={44} /><View style={styles.groupCopy}><Text style={[styles.groupTitle, { color: key === 'calciumade' ? theme.text : theme.heme }]}>{first.vitaminName}</Text><Text style={[styles.groupMeta, { color: theme.textSecondary }]}>{first.brand} · {first.description}</Text><Text style={[styles.frequency, { color: theme.textSecondary }]}>{group.length} {group.length === 1 ? 'dose' : 'doses'} daily</Text></View></View>
        <View style={[styles.rows, shadows.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>{group.map((reminder, index) => <Pressable key={reminder.id} disabled={updatingReminderIds.includes(reminder.id)} onPress={() => router.push(`/reminder/${reminder.id}` as Href)} style={({ pressed }) => [styles.row, index < group.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.divider }, pressed && { backgroundColor: theme.input }]}>
          <View style={[styles.doseDot, { backgroundColor: key === 'calciumade' ? theme.calciumSoft : theme.hemeSoft }]}><Ionicons name="medical" size={17} color={key === 'calciumade' ? theme.calcium : theme.heme} /></View>
          <View style={styles.rowCopy}><Text style={[styles.dose, { color: theme.text }]}>{reminder.doseLabel}</Text><Text style={[styles.period, { color: theme.textSecondary }]}>{reminder.mealPeriod}</Text></View>
          <View style={styles.timeWrap}><Text style={[styles.time, { color: theme.text }]}>{formatTime(reminder.scheduledTime)}</Text><Ionicons name="chevron-forward" size={17} color={theme.muted} /></View>
          <AppSwitch accessibilityLabel={`${reminder.vitaminName} ${reminder.doseLabel} enabled`} value={reminder.enabled} disabled={updatingReminderIds.includes(reminder.id)} onValueChange={(value) => void toggle(reminder.id, value)} />
        </Pressable>)}</View>
      </View>;
    })}
  </Screen>;
}
const styles = StyleSheet.create({ content: { paddingBottom: 28 }, info: { borderWidth: 1, borderRadius: radius.lg, padding: 15, flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: spacing.xl }, infoText: { fontSize: 13, fontWeight: '700' }, infoSub: { fontSize: 12, marginTop: 4 }, group: { marginBottom: 27 }, groupHead: { flexDirection: 'row', alignItems: 'center', marginBottom: 13 }, groupCopy: { flex: 1, marginLeft: 12 }, groupTitle: { fontSize: 19, fontWeight: '800' }, groupMeta: { fontSize: 11, marginTop: 3 }, frequency: { fontSize: 11, fontWeight: '700', marginTop: 5, textTransform: 'uppercase', letterSpacing: 0.7 }, rows: { borderWidth: 1, borderRadius: radius.xl, overflow: 'hidden' }, row: { minHeight: 90, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 14, gap: 10 }, doseDot: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, rowCopy: { flex: 1 }, dose: { fontSize: 14, fontWeight: '800' }, period: { fontSize: 11, marginTop: 5 }, timeWrap: { flexDirection: 'row', alignItems: 'center', gap: 1 }, time: { fontSize: 14, fontWeight: '800' } });
