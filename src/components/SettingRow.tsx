import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/hooks/useTheme';
import { AppSwitch } from './AppSwitch';

type Props = { icon: keyof typeof Ionicons.glyphMap; label: string; description?: string; value?: string; onPress?: () => void; toggle?: boolean; toggleValue?: boolean; onToggle?: (value: boolean) => void; danger?: boolean; disabled?: boolean; last?: boolean };

export function SettingRow({ icon, label, description, value, onPress, toggle, toggleValue, onToggle, danger, disabled, last }: Props) {
  const { theme } = useTheme();
  return (
    <Pressable disabled={!onPress || disabled} onPress={onPress} style={({ pressed }) => [styles.row, disabled && styles.disabled, !last && { borderBottomColor: theme.divider, borderBottomWidth: 1 }, pressed && { backgroundColor: theme.input, transform: [{ scale: 0.99 }] }]}>
      <View style={[styles.icon, { backgroundColor: danger ? theme.dangerSoft : theme.primarySoft }]}><Ionicons name={icon} size={18} color={danger ? theme.danger : theme.primaryStrong} /></View>
      <View style={styles.copy}><Text style={[styles.label, { color: danger ? theme.danger : theme.text }]}>{label}</Text>{description && <Text style={[styles.description, { color: theme.textSecondary }]}>{description}</Text>}</View>
      {value && <Text style={[styles.value, { color: theme.textSecondary }]} numberOfLines={1}>{value}</Text>}
      {toggle && <AppSwitch accessibilityLabel={label} value={Boolean(toggleValue)} onValueChange={(next) => onToggle?.(next)} />}
      {onPress && !toggle && <Ionicons name="chevron-forward" size={18} color={theme.muted} />}
    </Pressable>
  );
}
const styles = StyleSheet.create({ row: { minHeight: 64, paddingVertical: 10, paddingHorizontal: 14, flexDirection: 'row', alignItems: 'center', gap: 11 }, disabled: { opacity: 0.48 }, icon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center' }, copy: { flex: 1 }, label: { fontSize: 14, fontWeight: '600' }, description: { fontSize: 11, lineHeight: 16, marginTop: 3 }, value: { maxWidth: '32%', fontSize: 12, fontWeight: '600', textAlign: 'right' }, });
