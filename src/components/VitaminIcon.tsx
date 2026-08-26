import { StyleSheet, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { Reminder } from '@/types';
import { useTheme } from '@/hooks/useTheme';

export function VitaminIcon({ vitaminKey, size = 46 }: { vitaminKey: Reminder['vitaminKey']; size?: number }) {
  const { theme } = useTheme();
  const calcium = vitaminKey === 'calciumade';
  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size / 2, backgroundColor: calcium ? theme.calciumSoft : theme.hemeSoft }]}>
      <FontAwesome6 name={calcium ? 'capsules' : 'heart'} size={size * 0.42} color={calcium ? theme.calcium : theme.heme} solid={!calcium} />
    </View>
  );
}
const styles = StyleSheet.create({ wrap: { alignItems: 'center', justifyContent: 'center' } });
