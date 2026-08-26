import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { VitaminIcon } from '@/components/VitaminIcon';
import { OptionSheet } from '@/components/OptionSheet';
import { MEAL_PERIODS } from '@/constants/defaults';
import { radius, shadows, spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { useAppStore } from '@/store/useAppStore';
import { MealPeriod } from '@/types';
import { formatTime, timeFromDate, timeToDate } from '@/utils/time';
import { AppSwitch } from '@/components/AppSwitch';

export default function EditReminderScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { theme } = useTheme();
  const vibrationEnabled = useAppStore((state) => state.settings.vibrationEnabled);
  const saveReminder = useAppStore((state) => state.saveReminder);
  const reminder = useAppStore((state) => state.reminders.find((item) => item.id === Number(id)) ?? null);
  const [period, setPeriod] = useState<MealPeriod>('After Lunch');
  const [time, setTime] = useState('12:05');
  const [enabled, setEnabled] = useState(true);
  const [periodOpen, setPeriodOpen] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  useEffect(() => { if (reminder) { setPeriod(reminder.mealPeriod); setTime(reminder.scheduledTime); setEnabled(reminder.enabled); } }, [reminder]);
  if (!reminder) return <Screen><AppHeader title="Edit Reminder" back /><Text style={[styles.loading, { color: theme.textSecondary }]}>Loading reminder...</Text></Screen>;
  const onTime = (_event: DateTimePickerEvent, selected?: Date) => { if (Platform.OS === 'android') setPickerOpen(false); if (selected) setTime(timeFromDate(selected)); };
  const save = async () => {
    if (saving) return;
    setSaving(true);
    try {
      const result = await saveReminder(reminder.id, { mealPeriod: period, scheduledTime: time, enabled });
      if (result.changed && vibrationEnabled) void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      router.back();
      if (!result.notificationsSynchronized) {
        setTimeout(() => Alert.alert(
          'Schedule saved',
          'Schedule saved, but reminder notifications could not be updated. They will be repaired the next time MamaCare starts.',
        ), 150);
      }
    } catch (error) {
      if (__DEV__) console.warn('Reminder save failed', error);
      Alert.alert('Unable to save', 'Unable to save this reminder. Please try again.');
    } finally { setSaving(false); }
  };
  return <Screen contentStyle={styles.content}>
    <AppHeader title="Edit Reminder" back />
    <View style={styles.identity}><VitaminIcon vitaminKey={reminder.vitaminKey} size={76} /><Text style={[styles.name, { color: theme.text }]}>{reminder.vitaminName}</Text><Text style={[styles.dose, { color: theme.textSecondary }]}>{reminder.doseLabel} · {reminder.description} ({reminder.brand})</Text></View>
    <View style={[styles.card, shadows.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
      <Text style={[styles.label, { color: theme.textSecondary }]}>Meal / Period</Text>
      <Pressable onPress={() => setPeriodOpen(true)} style={[styles.control, { backgroundColor: theme.input, borderColor: theme.border }]}><Ionicons name="restaurant-outline" size={19} color={theme.primaryStrong} /><Text style={[styles.controlText, { color: theme.text }]}>{period}</Text><Ionicons name="chevron-down" size={18} color={theme.textSecondary} /></Pressable>
      <Text style={[styles.label, styles.timeLabel, { color: theme.textSecondary }]}>Reminder Time</Text>
      <Pressable onPress={() => setPickerOpen(true)} style={[styles.control, { backgroundColor: theme.input, borderColor: theme.border }]}><Ionicons name="time-outline" size={19} color={theme.primaryStrong} /><Text style={[styles.controlText, { color: theme.text }]}>{formatTime(time)}</Text><Ionicons name="chevron-forward" size={18} color={theme.textSecondary} /></Pressable>
      {pickerOpen && <DateTimePicker value={timeToDate(time)} mode="time" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={onTime} />}
    </View>
    <View style={[styles.card, styles.toggleCard, shadows.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, opacity: enabled ? 1 : 0.72 }]}><View style={styles.toggleCopy}><Text style={[styles.toggleTitle, { color: theme.text }]}>Reminder status</Text><Text style={[styles.toggleSub, { color: theme.textSecondary }]}>{enabled ? 'Active · daily notification scheduled' : 'Disabled · no notification scheduled'}</Text></View><AppSwitch accessibilityLabel="Reminder enabled" value={enabled} onValueChange={setEnabled} /></View>
    <View style={[styles.notice, { backgroundColor: theme.primarySoft }]}><Ionicons name="information-circle-outline" size={19} color={theme.primaryStrong} /><Text style={[styles.noticeText, { color: theme.textSecondary }]}>The prescribed daily frequency cannot be changed in MamaCare.</Text></View>
    <Pressable disabled={saving} onPress={() => void save()} style={({ pressed }) => [styles.save, { backgroundColor: theme.primary, opacity: saving ? 0.62 : 1, transform: [{ scale: pressed ? 0.98 : 1 }] }]}><Ionicons name="checkmark-circle-outline" size={20} color={theme.white} /><Text style={styles.saveText}>{saving ? 'Saving…' : 'Save Changes'}</Text></Pressable>
    <OptionSheet visible={periodOpen} title="Meal / Period" options={MEAL_PERIODS} value={period} onSelect={setPeriod} onClose={() => setPeriodOpen(false)} />
  </Screen>;
}
const styles = StyleSheet.create({ content: { paddingBottom: 32 }, loading: { textAlign: 'center', marginTop: 40 }, identity: { alignItems: 'center', paddingVertical: 20 }, name: { fontSize: 22, fontWeight: '800', marginTop: 13 }, dose: { fontSize: 12, textAlign: 'center', marginTop: 6 }, card: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.lg, marginTop: 14 }, label: { fontSize: 11, fontWeight: '800', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 0.7 }, timeLabel: { marginTop: 18 }, control: { minHeight: 56, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 10 }, controlText: { flex: 1, fontSize: 15, fontWeight: '700' }, toggleCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, toggleCopy: { flex: 1, paddingRight: 12 }, toggleTitle: { fontSize: 14, fontWeight: '800' }, toggleSub: { fontSize: 11, lineHeight: 16, marginTop: 4 }, notice: { borderRadius: radius.lg, padding: 14, flexDirection: 'row', gap: 9, marginTop: 14 }, noticeText: { flex: 1, fontSize: 12, lineHeight: 18 }, save: { height: 54, borderRadius: radius.lg, marginTop: 20, flexDirection: 'row', gap: 8, alignItems: 'center', justifyContent: 'center' }, saveText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' } });
