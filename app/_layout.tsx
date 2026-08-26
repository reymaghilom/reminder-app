import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useAppStore } from '@/store/useAppStore';
import { useTheme } from '@/hooks/useTheme';
import { LoadingView } from '@/components/LoadingView';
import { ThemeProvider } from '@/providers/ThemeProvider';

export default function RootLayout() {
  return <ThemeProvider><AppNavigator /></ThemeProvider>;
}

function AppNavigator() {
  const initialize = useAppStore((state) => state.initialize);
  const ready = useAppStore((state) => state.ready);
  const error = useAppStore((state) => state.error);
  const { theme, darkMode } = useTheme();
  useEffect(() => { void initialize(); }, [initialize]);
  if (!ready) return <LoadingView error={error} />;
  return <><StatusBar style={darkMode ? 'light' : 'dark'} /><Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.background }, animation: 'slide_from_right' }} /></>;
}
