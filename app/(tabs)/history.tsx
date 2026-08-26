import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Alert, Animated, Easing, Pressable, StyleSheet, Text, View } from 'react-native';
import { Href, router, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { VitaminIcon } from '@/components/VitaminIcon';
import { StatusBadge } from '@/components/StatusBadge';
import { listIntakesForRange } from '@/database/repositories/intakeLogs';
import { listReminderOccurrencesForDate } from '@/database/repositories/reminderOccurrences';
import { listReminders } from '@/database/repositories/reminders';
import { useTheme } from '@/hooks/useTheme';
import { IntakeLog, ReminderWithStatus } from '@/types';
import { dateKey, formatShortDate } from '@/utils/date';
import { combineReminders } from '@/utils/reminderStatus';
import { formatTakenTime, formatTime } from '@/utils/time';
import { radius, shadows } from '@/constants/theme';
import { useAppStore } from '@/store/useAppStore';

const week = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];

export default function HistoryScreen() {
  const { theme, reduceMotion } = useTheme();
  const settings = useAppStore((state) => state.settings);
  const markTaken = useAppStore((state) => state.markTaken);
  const [month, setMonth] = useState(() => new Date(new Date().getFullYear(), new Date().getMonth(), 1));
  const [selected, setSelected] = useState(dateKey());
  const [monthIntakes, setMonthIntakes] = useState<IntakeLog[]>([]);
  const [items, setItems] = useState<ReminderWithStatus[]>([]);
  const selectionReveal = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduceMotion) return;
    selectionReveal.setValue(0.35);
    Animated.timing(selectionReveal, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [reduceMotion, selected, selectionReveal]);
  const load = useCallback(async () => {
    const start = dateKey(new Date(month.getFullYear(), month.getMonth(), 1));
    const end = dateKey(new Date(month.getFullYear(), month.getMonth() + 1, 0));
    const [reminders, intakes, occurrences] = await Promise.all([listReminders(), listIntakesForRange(start, end), listReminderOccurrencesForDate(selected)]);
    const selectedIntakes = intakes.filter((item) => item.scheduledDate === selected);
    setMonthIntakes(intakes); setItems(combineReminders(reminders, selectedIntakes, occurrences, selected, settings));
  }, [month, selected, settings]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  const cells = useMemo(() => {
    const leading = month.getDay(); const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [...Array(leading).fill(null), ...Array.from({ length: count }, (_, i) => i + 1)];
  }, [month]);
  const intakeCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const intake of monthIntakes) counts.set(intake.scheduledDate, (counts.get(intake.scheduledDate) ?? 0) + 1);
    return counts;
  }, [monthIntakes]);
  const moveMonth = (delta: number) => { const next = new Date(month.getFullYear(), month.getMonth() + delta, 1); setMonth(next); setSelected(dateKey(next)); };
  const expected = items.filter((item) => item.enabled).length;
  const completed = items.filter((item) => item.status === 'taken').length;
  const confirmTakenLater = (item: ReminderWithStatus) => Alert.alert('Mark this dose as taken?', 'The current confirmation time will be recorded. The original scheduled time will remain unchanged.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Mark as Taken', onPress: () => void markTaken(item, selected).then(load).catch(() => Alert.alert('Could not save', 'Please try marking this reminder again.')) },
  ]);
  return <Screen contentStyle={styles.content}>
    <AppHeader title="History" right={<Ionicons name="calendar-outline" size={23} color={theme.text} />} />
    <View style={[styles.calendar, shadows.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
      <View style={styles.monthRow}><Pressable accessibilityLabel="Previous month" onPress={() => moveMonth(-1)} style={({ pressed }) => [styles.nav, pressed && { backgroundColor: theme.input, transform: [{ scale: 0.96 }] }]}><Ionicons name="chevron-back" size={21} color={theme.text} /></Pressable><Text style={[styles.month, { color: theme.text }]}>{month.toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</Text><Pressable accessibilityLabel="Next month" onPress={() => moveMonth(1)} style={({ pressed }) => [styles.nav, pressed && { backgroundColor: theme.input, transform: [{ scale: 0.96 }] }]}><Ionicons name="chevron-forward" size={21} color={theme.text} /></Pressable></View>
      <View style={styles.weekRow}>{week.map((day, index) => <Text key={`${day}-${index}`} style={[styles.weekDay, { color: theme.muted }]}>{day}</Text>)}</View>
      <View style={styles.grid}>{cells.map((day, index) => {
        if (!day) return <View key={`blank-${index}`} style={styles.cell} />;
        const key = dateKey(new Date(month.getFullYear(), month.getMonth(), day));
        const taken = intakeCounts.get(key) ?? 0;
        const past = key < dateKey(); const future = key > dateKey();
        const color = future ? theme.muted : taken >= 3 ? theme.primary : taken > 0 ? theme.calcium : past ? theme.warning : theme.muted;
        const active = key === selected;
        return <Pressable accessibilityRole="button" accessibilityState={{ selected: active }} accessibilityLabel={`${key}, ${taken} reminders completed`} key={key} onPress={() => setSelected(key)} style={({ pressed }) => [styles.cell, active && { backgroundColor: theme.primary }, pressed && { transform: [{ scale: 0.94 }] }]}><Text style={[styles.day, { color: active ? theme.white : theme.text }]}>{day}</Text>{!future && <View style={[styles.indicator, { backgroundColor: active ? theme.white : color }]} />}</Pressable>;
      })}</View>
      <View style={styles.legend}><Legend color={theme.primary} text="Complete" /><Legend color={theme.calcium} text="Partial" /><Legend color={theme.warning} text="Unconfirmed" /><Legend color={theme.muted} text="No data" /></View>
    </View>
    <Animated.View style={{ opacity: selectionReveal, transform: [{ translateY: selectionReveal.interpolate({ inputRange: [0, 1], outputRange: [4, 0] }) }] }}>
    <Pressable onPress={() => router.push(`/day/${selected}` as Href)} style={[styles.summaryHead, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}><View><Text style={[styles.summaryDate, { color: theme.text }]}>{formatShortDate(selected)}</Text><Text style={[styles.summaryCount, { color: theme.textSecondary }]}>{completed} of {expected} completed</Text></View><Ionicons name="chevron-forward" size={21} color={theme.muted} /></Pressable>
    <View style={[styles.list, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>{items.map((item, index) => <View key={item.id} style={[styles.itemContainer, index < items.length - 1 && { borderBottomWidth: 1, borderBottomColor: theme.divider }]}>
      <View style={styles.item}><VitaminIcon vitaminKey={item.vitaminKey} size={40} /><View style={styles.itemCopy}><Text style={[styles.itemName, { color: theme.text }]}>{item.vitaminName} · {item.doseLabel}</Text><Text style={[styles.itemMeta, { color: theme.textSecondary }]}>Scheduled {formatTime(item.scheduledTime)} · {item.mealPeriod}</Text></View><View style={styles.itemRight}><Text style={[styles.itemTime, { color: theme.textSecondary }]}>{item.intake ? `Confirmed ${formatTakenTime(item.intake.takenAt)}` : 'Not marked as taken'}</Text><StatusBadge status={item.status} /></View></View>
      {item.status === 'unconfirmed' && item.enabled && selected <= dateKey() && <Pressable accessibilityRole="button" onPress={() => confirmTakenLater(item)} style={({ pressed }) => [styles.markLater, { backgroundColor: theme.calciumSoft, borderColor: theme.warning, opacity: pressed ? 0.72 : 1 }]}><Ionicons name="checkmark-circle-outline" size={17} color={theme.warning} /><Text style={[styles.markLaterText, { color: theme.warning }]}>Mark as Taken Later</Text></Pressable>}
    </View>)}</View>
    </Animated.View>
  </Screen>;
}
function Legend({ color, text }: { color: string; text: string }) { const { theme } = useTheme(); return <View style={styles.legendItem}><View style={[styles.legendDot, { backgroundColor: color }]} /><Text style={[styles.legendText, { color: theme.textSecondary }]}>{text}</Text></View>; }
const styles = StyleSheet.create({ content: { paddingBottom: 28 }, calendar: { borderWidth: 1, borderRadius: radius.xl, padding: 14 }, monthRow: { height: 46, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, nav: { width: 42, height: 42, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, month: { fontSize: 16, fontWeight: '800' }, weekRow: { flexDirection: 'row' }, weekDay: { width: `${100 / 7}%`, textAlign: 'center', fontSize: 10, fontWeight: '800', paddingVertical: 9 }, grid: { flexDirection: 'row', flexWrap: 'wrap' }, cell: { width: `${100 / 7}%`, aspectRatio: 1, alignItems: 'center', justifyContent: 'center', borderRadius: 999 }, day: { fontSize: 12, fontWeight: '700' }, indicator: { width: 4, height: 4, borderRadius: 2, marginTop: 3 }, legend: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 12, paddingTop: 12 }, legendItem: { flexDirection: 'row', alignItems: 'center', gap: 4 }, legendDot: { width: 6, height: 6, borderRadius: 3 }, legendText: { fontSize: 9, fontWeight: '600' }, summaryHead: { minHeight: 74, borderWidth: 1, borderRadius: radius.xl, paddingHorizontal: 16, marginTop: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, summaryDate: { fontSize: 16, fontWeight: '800' }, summaryCount: { fontSize: 11, marginTop: 4 }, list: { borderWidth: 1, borderRadius: radius.xl, marginTop: 10, overflow: 'hidden' }, itemContainer: { paddingBottom: 10 }, item: { minHeight: 78, padding: 12, flexDirection: 'row', alignItems: 'center', gap: 10 }, itemCopy: { flex: 1 }, itemName: { fontSize: 12, fontWeight: '800' }, itemMeta: { fontSize: 10, marginTop: 4 }, itemRight: { maxWidth: 118, alignItems: 'flex-end', gap: 6 }, itemTime: { fontSize: 10, fontWeight: '700', textAlign: 'right' }, markLater: { height: 38, marginHorizontal: 12, borderWidth: 1, borderRadius: radius.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6 }, markLaterText: { fontSize: 11, fontWeight: '800' } });
