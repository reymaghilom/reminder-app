import { StyleSheet, View } from 'react-native';
import { FontAwesome6 } from '@expo/vector-icons';
import { Reminder } from '@/types';
import { useTheme } from '@/hooks/useTheme';

export function VitaminIcon({ size = 46 }: { vitaminKey: Reminder['vitaminKey']; size?: number }) {
  const { theme } = useTheme();
  return (
    <View style={[styles.wrap, { width: size, height: size, borderRadius: size / 2, backgroundColor: theme.primarySoft }]}>
      <FontAwesome6 name="pills" size={size * 0.42} color={theme.primaryStrong} solid />
    </View>
  );
}
const styles = StyleSheet.create({ wrap: { alignItems: 'center', justifyContent: 'center' } });
