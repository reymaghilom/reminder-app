import { PropsWithChildren, createContext, useEffect, useMemo, useState } from 'react';
import { AccessibilityInfo } from 'react-native';
import { getTheme, lightTheme } from '@/constants/theme';
import { useAppStore } from '@/store/useAppStore';

type ThemeContextValue = {
  theme: typeof lightTheme;
  darkMode: boolean;
  reduceMotion: boolean;
};

export const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: PropsWithChildren) {
  const darkMode = useAppStore((state) => state.settings.darkMode);
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    void AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => subscription.remove();
  }, []);

  const value = useMemo<ThemeContextValue>(() => ({
    theme: getTheme(darkMode),
    darkMode,
    reduceMotion,
  }), [darkMode, reduceMotion]);

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
}
