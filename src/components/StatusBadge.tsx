import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text } from 'react-native';
import { ReminderStatus } from '@/types';
import { useTheme } from '@/hooks/useTheme';

const labels: Record<ReminderStatus, string> = { upcoming: 'Upcoming', due: 'Due', taken: 'Taken', unconfirmed: 'Unconfirmed', disabled: 'Disabled' };

export function StatusBadge({ status }: { status: ReminderStatus }) {
  const { theme, reduceMotion } = useTheme();
  const reveal = useRef(new Animated.Value(1)).current;
  useEffect(() => {
    if (reduceMotion) return;
    reveal.setValue(0.55);
    Animated.timing(reveal, { toValue: 1, duration: 180, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [reduceMotion, reveal, status]);
  const palette = status === 'taken' ? [theme.primarySoft, theme.primaryStrong]
    : status === 'upcoming' ? [theme.input, theme.muted]
      : status === 'due' ? [theme.primarySoft, theme.primaryStrong]
        : status === 'unconfirmed' ? [theme.warningSoft, theme.warning] : [theme.input, theme.muted];
  return <Animated.View style={[styles.badge, { backgroundColor: palette[0], opacity: reveal, transform: [{ scale: reveal.interpolate({ inputRange: [0, 1], outputRange: [0.96, 1] }) }] }]}><Text style={[styles.text, { color: palette[1] }]}>{labels[status]}</Text></Animated.View>;
}
const styles = StyleSheet.create({ badge: { width: 76, height: 26, borderRadius: 9, alignItems: 'center', justifyContent: 'center' }, text: { fontSize: 10, fontWeight: '800' } });
