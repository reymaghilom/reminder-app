import { PropsWithChildren } from 'react';
import { ScrollView, ScrollViewProps, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { screenPadding } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';

type Props = PropsWithChildren<{ contentStyle?: ScrollViewProps['contentContainerStyle'] }>;

export function Screen({ children, contentStyle }: Props) {
  const { theme } = useTheme();
  return (
    <SafeAreaView edges={['top', 'left', 'right']} style={[styles.safe, { backgroundColor: theme.background }]}>
      <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} contentContainerStyle={[styles.content, contentStyle]}>{children}</ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({ safe: { flex: 1 }, content: { paddingHorizontal: screenPadding, paddingBottom: 32 } });
