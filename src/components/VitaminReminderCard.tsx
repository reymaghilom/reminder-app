import { useEffect, useRef, useState } from 'react';
import { Alert, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { ReminderWithStatus } from '@/types';
import { formatTakenTime, formatTime, scheduledDateTime } from '@/utils/time';
import { radius, shadows, spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useAppStore } from '@/store/useAppStore';
import { dateKey } from '@/utils/date';
import { VitaminIcon } from './VitaminIcon';
import { StatusBadge } from './StatusBadge';
import { AppSwitch } from './AppSwitch';
import { scheduleLabel } from '@/utils/scheduleLabel';

type Props = { reminder: ReminderWithStatus; canTake?: boolean; scheduledDate?: string; onTakenRecorded?: () => void; showToggle?: boolean };

export function VitaminReminderCard({ reminder, canTake = true, scheduledDate = dateKey(), onTakenRecorded, showToggle = false }: Props) {
  const { theme, reduceMotion } = useTheme();
  const markTaken = useAppStore((state) => state.markTaken);
  const toggleReminder = useAppStore((state) => state.toggleReminder);
  const updatingReminderIds = useAppStore((state) => state.updatingReminderIds);
  const vibrationEnabled = useAppStore((state) => state.settings.vibrationEnabled);
  const [busy, setBusy] = useState(false);
  const enabledProgress = useRef(new Animated.Value(reminder.enabled ? 1 : 0)).current;
  useEffect(() => {
    Animated.timing(enabledProgress, { toValue: reminder.enabled ? 1 : 0, duration: reduceMotion ? 0 : 200, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [enabledProgress, reduceMotion, reminder.enabled]);
  const toggleBusy = updatingReminderIds.includes(reminder.id);
  const actionable = canTake && reminder.enabled && (reminder.status === 'due' || reminder.status === 'unconfirmed');
  const showNotDue = () => Alert.alert(
    'Not Due Yet',
    `This vitamin is scheduled for ${formatTime(reminder.scheduledTime)}. You can mark it as taken when the scheduled time arrives.`,
  );
  const saveTaken = async () => {
    if (busy || toggleBusy) return;
    setBusy(true);
    try {
      const created = await markTaken(reminder, scheduledDate);
      if (created && vibrationEnabled) await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      if (created) onTakenRecorded?.();
      if (!created) Alert.alert('Already recorded', 'This dose has already been marked as taken.');
    } catch (error) {
      if (error instanceof Error && error.message === 'REMINDER_NOT_DUE') showNotDue();
      else Alert.alert('Could not save', 'Please try marking this reminder again.');
    }
    finally { setBusy(false); }
  };
  const onTaken = () => {
    if (reminder.status !== 'unconfirmed') return void saveTaken();
    Alert.alert('Mark this dose as taken?', 'The current confirmation time will be recorded. The original scheduled time will remain unchanged.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Mark as Taken', onPress: () => void saveTaken() },
    ]);
  };
  const onNotDue = () => {
    if (new Date() >= scheduledDateTime(scheduledDate, reminder.scheduledTime)) void saveTaken();
    else showNotDue();
  };
  const onToggle = async (enabled: boolean) => {
    try {
      const result = await toggleReminder(reminder.id, enabled);
      if (!result.notificationsSynchronized) Alert.alert(
        'Reminder updated',
        'The reminder was updated, but notifications could not be synchronized. Reminder App will repair them the next time it starts.',
      );
    } catch (error) {
      if (__DEV__) console.warn('Reminder toggle failed', error);
      Alert.alert('Unable to update', 'Unable to update this reminder. Please try again.');
    }
  };
  const accent = theme.primary;
  return (
    <Animated.View style={[styles.card, shadows.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, borderLeftColor: accent, opacity: enabledProgress.interpolate({ inputRange: [0, 1], outputRange: [0.64, 1] }) }]}>
      <View style={styles.header}>
        <VitaminIcon vitaminKey={reminder.vitaminKey} />
        <View style={styles.identity}><Text style={[styles.name, { color: theme.text }]}>{reminder.vitaminName}</Text><Text style={[styles.description, { color: theme.textSecondary }]}>{reminder.description} · {reminder.brand}</Text></View>
        <StatusBadge status={reminder.status} />
      </View>
      <View style={[styles.meta, { borderTopColor: theme.divider }]}>
        <View style={styles.metaItem}><Ionicons name="restaurant-outline" size={16} color={theme.textSecondary} /><Text style={[styles.metaText, { color: theme.textSecondary }]}>{reminder.doseLabel} · {scheduleLabel(reminder.mealPeriod, reminder.customScheduleLabel)}</Text></View>
        <Text style={[styles.time, { color: theme.text }]}>{formatTime(reminder.scheduledTime)}</Text>
      </View>
      {showToggle && <View style={[styles.toggleRow, { borderTopColor: theme.divider }]}><View><Text style={[styles.toggleLabel, { color: theme.text }]}>Reminder</Text><Text style={[styles.toggleState, { color: theme.textSecondary }]}>{reminder.enabled ? 'Enabled' : 'Disabled'}</Text></View><AppSwitch accessibilityLabel={`${reminder.vitaminName} ${reminder.doseLabel} enabled`} value={reminder.enabled} disabled={toggleBusy || busy} onValueChange={(value) => void onToggle(value)} /></View>}
      {canTake && <View style={styles.actionSlot}>{reminder.status === 'taken' && reminder.intake
        ? <View style={[styles.taken, { backgroundColor: theme.primarySoft }]}><Ionicons name="checkmark-circle" size={20} color={theme.primaryStrong} /><Text style={[styles.takenText, { color: theme.primaryStrong }]}>Taken at {formatTakenTime(reminder.intake.takenAt)}</Text></View>
        : reminder.status === 'upcoming'
          ? <Pressable disabled={toggleBusy} accessibilityRole="button" accessibilityLabel={`Not due yet. Scheduled for ${formatTime(reminder.scheduledTime)}`} onPress={onNotDue} style={({ pressed }) => [styles.notDue, { backgroundColor: theme.input, borderColor: theme.border, opacity: toggleBusy ? 0.6 : pressed ? 0.72 : 1 }]}><Ionicons name="time-outline" size={18} color={theme.muted} /><View><Text style={[styles.notDueTitle, { color: theme.textSecondary }]}>Not Due Yet</Text><Text style={[styles.notDueTime, { color: theme.muted }]}>Scheduled for {formatTime(reminder.scheduledTime)}</Text></View></Pressable>
        : actionable
          ? <Pressable disabled={busy || toggleBusy} accessibilityRole="button" onPress={onTaken} style={({ pressed }) => [styles.primary, { backgroundColor: reminder.status === 'unconfirmed' ? theme.warning : accent, opacity: busy || toggleBusy ? 0.6 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}><Ionicons name="checkmark" size={18} color={theme.white} /><Text style={styles.primaryText}>{busy || toggleBusy ? 'Updating...' : reminder.status === 'unconfirmed' ? 'Mark as Taken Later' : 'Mark as Taken'}</Text></Pressable>
          : <View style={[styles.disabledNote, { backgroundColor: theme.input }]}><Ionicons name="notifications-off-outline" size={18} color={theme.muted} /><Text style={[styles.disabledText, { color: theme.textSecondary }]}>Reminder is currently disabled</Text></View>}
      </View>}
    </Animated.View>
  );
}

const styles = StyleSheet.create({ card: { borderWidth: 1, borderLeftWidth: 4, borderRadius: radius.xl, padding: spacing.md, marginBottom: 13 }, header: { flexDirection: 'row', alignItems: 'center' }, identity: { flex: 1, marginHorizontal: 12 }, name: { fontSize: 16, fontWeight: '800' }, description: { fontSize: 11, marginTop: 3, lineHeight: 16 }, meta: { borderTopWidth: 1, marginTop: 14, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, metaItem: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 7 }, metaText: { fontSize: 12, flexShrink: 1 }, time: { fontSize: 15, fontWeight: '800', letterSpacing: 0.1 }, toggleRow: { minHeight: 55, borderTopWidth: 1, marginTop: 12, paddingTop: 6, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, toggleLabel: { fontSize: 12, fontWeight: '800' }, toggleState: { fontSize: 10, fontWeight: '600', marginTop: 2 }, actionSlot: { minHeight: 44, marginTop: 13 }, taken: { height: 44, borderRadius: radius.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, takenText: { fontSize: 12, fontWeight: '700' }, notDue: { minHeight: 50, borderRadius: radius.sm, borderWidth: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 }, notDueTitle: { fontSize: 12, fontWeight: '800', textAlign: 'center' }, notDueTime: { fontSize: 10, fontWeight: '600', marginTop: 2, textAlign: 'center' }, primary: { height: 44, borderRadius: radius.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, primaryText: { color: '#FFFFFF', fontWeight: '800', fontSize: 13 }, disabledNote: { height: 44, borderRadius: radius.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 }, disabledText: { fontSize: 12, fontWeight: '600' } });
