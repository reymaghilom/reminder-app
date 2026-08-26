import { ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useTheme } from '@/hooks/useTheme';

export function AppHeader({ title, back = false, right }: { title: string; back?: boolean; right?: ReactNode }) {
  const { theme } = useTheme();
  return (
    <View style={styles.row}>
      <View style={styles.side}>{back && <Pressable accessibilityRole="button" accessibilityLabel="Go back" hitSlop={8} onPress={() => router.back()} style={({ pressed }) => [styles.iconButton, { backgroundColor: pressed ? theme.input : 'transparent', transform: [{ scale: pressed ? 0.96 : 1 }] }]}><Ionicons name="chevron-back" size={23} color={theme.text} /></Pressable>}</View>
      <Text style={[styles.title, { color: theme.text }]} numberOfLines={1}>{title}</Text>
      <View style={[styles.side, styles.right]}>{right}</View>
    </View>
  );
}

const styles = StyleSheet.create({ row: { height: 62, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, side: { width: 64 }, right: { alignItems: 'flex-end' }, title: { flex: 1, textAlign: 'center', fontSize: 18, fontWeight: '800', letterSpacing: -0.2 }, iconButton: { width: 42, height: 42, borderRadius: 14, alignItems: 'center', justifyContent: 'center' } });
