import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '@/hooks/useTheme';

const icons = { index: 'home-outline', schedule: 'calendar-outline', history: 'stats-chart-outline', settings: 'settings-outline' } as const;

export default function TabsLayout() {
  const { theme } = useTheme();
  const insets = useSafeAreaInsets();
  return <Tabs screenOptions={({ route }) => ({
    headerShown: false,
    tabBarActiveTintColor: theme.primary,
    tabBarInactiveTintColor: theme.muted,
    tabBarStyle: { backgroundColor: 'transparent', borderTopColor: theme.border, height: 68 + insets.bottom, paddingTop: 8, paddingBottom: Math.max(insets.bottom, 9) },
    tabBarBackground: () => <View style={[StyleSheet.absoluteFill, { backgroundColor: theme.surface }]} />,
    tabBarLabelStyle: { fontSize: 10, fontWeight: '700', letterSpacing: 0.2 },
    tabBarIcon: ({ color, size, focused }) => <View style={[styles.iconWrap, focused && { backgroundColor: theme.primarySoft }]}><Ionicons name={focused ? icons[route.name as keyof typeof icons].replace('-outline', '') as keyof typeof Ionicons.glyphMap : icons[route.name as keyof typeof icons]} size={focused ? size + 1 : size} color={color} /></View>,
  })}>
    <Tabs.Screen name="index" options={{ title: 'Home' }} />
    <Tabs.Screen name="schedule" options={{ title: 'Schedule' }} />
    <Tabs.Screen name="history" options={{ title: 'History' }} />
    <Tabs.Screen name="settings" options={{ title: 'Settings' }} />
  </Tabs>;
}

const styles = StyleSheet.create({ iconWrap: { width: 38, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' } });
