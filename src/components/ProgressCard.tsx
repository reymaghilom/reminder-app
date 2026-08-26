import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { ReminderStatus, ReminderWithStatus } from '@/types';
import { radius, shadows, spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

export function ProgressCard({ reminders }: { reminders: ReminderWithStatus[] }) {
  const { theme, reduceMotion } = useTheme();
  const active = reminders.filter((item) => item.enabled);
  const completed = active.filter((item) => item.status === 'taken').length;
  const countReveal = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduceMotion) return;
    countReveal.setValue(0.45);
    Animated.timing(countReveal, { toValue: 1, duration: 220, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [completed, countReveal, reduceMotion]);
  if (!active.length) return (
    <View style={[styles.card, shadows.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
      <View style={styles.top}><View><Text style={[styles.eyebrow, { color: theme.primaryStrong }]}>DAILY WELLNESS</Text><Text style={[styles.title, { color: theme.text }]}>Today&apos;s Progress</Text></View><View style={[styles.neutralIcon, { backgroundColor: theme.input }]}><Ionicons name="pause-outline" size={20} color={theme.muted} /></View></View>
      <Text style={[styles.neutralTitle, { color: theme.textSecondary }]}>No active doses today</Text>
      <Text style={[styles.neutralText, { color: theme.muted }]}>Enable a dose in Schedule when you want it included in today&apos;s progress.</Text>
    </View>
  );
  return (
    <View style={[styles.card, shadows.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
      <View style={styles.top}><View><Text style={[styles.eyebrow, { color: theme.primaryStrong }]}>DAILY WELLNESS</Text><Text style={[styles.title, { color: theme.text }]}>Today&apos;s Progress</Text></View><Animated.Text style={[styles.count, { color: theme.text, opacity: countReveal, transform: [{ scale: countReveal.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }]}>{completed} of {active.length}</Animated.Text></View>
      <View style={styles.bottom}>
        <View style={styles.dots}>{active.map((item) => <ProgressDot key={item.id} status={item.status} />)}</View>
        <Text style={[styles.caption, { color: theme.textSecondary }]}>completed</Text>
      </View>
    </View>
  );
}
function ProgressDot({ status }: { status: ReminderStatus }) {
  const { theme, reduceMotion } = useTheme();
  const reveal = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    reveal.setValue(reduceMotion ? 1 : 0.55);
    Animated.spring(reveal, { toValue: 1, damping: 15, stiffness: 180, mass: 0.7, useNativeDriver: true }).start();
  }, [reduceMotion, reveal, status]);
  const appearance = status === 'taken'
    ? { backgroundColor: theme.primary, borderColor: theme.primary, icon: 'checkmark' as const, iconColor: theme.white }
    : status === 'unconfirmed'
      ? { backgroundColor: theme.warning, borderColor: theme.warning, icon: 'time-outline' as const, iconColor: theme.white }
      : status === 'due'
        ? { backgroundColor: theme.warningSoft, borderColor: theme.warning, icon: 'time-outline' as const, iconColor: theme.warning }
        : status === 'disabled'
          ? { backgroundColor: theme.muted, borderColor: theme.muted, icon: null, iconColor: theme.white }
          : { backgroundColor: 'transparent', borderColor: theme.border, icon: null, iconColor: theme.muted };
  return <View style={[styles.dot, { backgroundColor: appearance.backgroundColor, borderColor: appearance.borderColor }]}><Animated.View style={{ opacity: reveal, transform: [{ scale: reveal }] }}>{appearance.icon && <Ionicons name={appearance.icon} size={18} color={appearance.iconColor} />}</Animated.View></View>;
}
const styles = StyleSheet.create({ card: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.lg, marginBottom: spacing.xl }, top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, eyebrow: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2, marginBottom: 4 }, title: { fontSize: 16, fontWeight: '800' }, count: { fontSize: 21, fontWeight: '800' }, neutralIcon: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, neutralTitle: { fontSize: 13, fontWeight: '800', marginTop: 16 }, neutralText: { fontSize: 11, lineHeight: 17, marginTop: 4 }, bottom: { marginTop: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }, dots: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, dot: { width: 38, height: 38, borderRadius: 19, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' }, caption: { fontSize: 11, fontWeight: '600' } });
