import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { radius, shadows } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

export function OptionSheet<T extends string | number>({ visible, title, options, value, suffix, onSelect, onClose }: { visible: boolean; title: string; options: readonly T[]; value: T; suffix?: string; onSelect: (value: T) => void; onClose: () => void }) {
  const { theme } = useTheme();
  return <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}><Pressable style={[styles.backdrop, { backgroundColor: theme.overlay }]} onPress={onClose}><Pressable style={[styles.sheet, shadows.card, { backgroundColor: theme.surfaceElevated }]} onPress={() => undefined}><View style={styles.head}><Text style={[styles.title, { color: theme.text }]}>{title}</Text><Pressable hitSlop={8} onPress={onClose}><Ionicons name="close" size={23} color={theme.text} /></Pressable></View>{options.map((option) => <Pressable key={option} onPress={() => { onSelect(option); onClose(); }} style={[styles.option, { borderTopColor: theme.divider }, option === value && { backgroundColor: theme.primarySoft }]}><Text style={[styles.optionText, { color: theme.text }]}>{String(option)}{suffix ?? ''}</Text>{option === value && <Ionicons name="checkmark" size={21} color={theme.primary} />}</Pressable>)}</Pressable></Pressable></Modal>;
}
const styles = StyleSheet.create({ backdrop: { flex: 1, justifyContent: 'center', padding: 24 }, sheet: { borderRadius: radius.xl, overflow: 'hidden' }, head: { minHeight: 64, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, title: { fontSize: 18, fontWeight: '800' }, option: { minHeight: 56, borderTopWidth: 1, paddingHorizontal: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }, optionText: { fontSize: 14, fontWeight: '600' } });
