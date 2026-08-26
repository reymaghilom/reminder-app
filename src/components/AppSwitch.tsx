import { useEffect, useRef } from 'react';
import { Animated, Easing, Pressable, StyleSheet } from 'react-native';
import { useTheme } from '@/hooks/useTheme';

type Props = { value: boolean; onValueChange: (value: boolean) => void; disabled?: boolean; accessibilityLabel?: string };

export function AppSwitch({ value, onValueChange, disabled = false, accessibilityLabel }: Props) {
  const { theme, reduceMotion } = useTheme();
  const thumbPosition = useRef(new Animated.Value(value ? 1 : 0)).current;
  const trackColorProgress = useRef(new Animated.Value(value ? 1 : 0)).current;
  useEffect(() => {
    thumbPosition.stopAnimation();
    trackColorProgress.stopAnimation();
    const duration = reduceMotion ? 0 : 180;
    const animations = [
      Animated.timing(thumbPosition, { toValue: value ? 1 : 0, duration, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(trackColorProgress, { toValue: value ? 1 : 0, duration, easing: Easing.out(Easing.cubic), useNativeDriver: false }),
    ];
    Animated.parallel(animations, { stopTogether: false }).start();
    return () => animations.forEach((animation) => animation.stop());
  }, [reduceMotion, thumbPosition, trackColorProgress, value]);
  const backgroundColor = trackColorProgress.interpolate({ inputRange: [0, 1], outputRange: [theme.border, theme.primary] });
  const translateX = thumbPosition.interpolate({ inputRange: [0, 1], outputRange: [2, 20] });
  return <Pressable
    accessibilityRole="switch"
    accessibilityLabel={accessibilityLabel}
    accessibilityState={{ checked: value, disabled }}
    disabled={disabled}
    hitSlop={8}
    onPress={(event) => { event.stopPropagation(); onValueChange(!value); }}
    style={({ pressed }) => [{ opacity: disabled ? 0.45 : pressed ? 0.84 : 1 }, styles.touch]}
  >
    <Animated.View style={[styles.track, { backgroundColor }]}>
      <Animated.View style={[styles.thumb, { backgroundColor: theme.white, transform: [{ translateX }] }]} />
    </Animated.View>
  </Pressable>;
}

const styles = StyleSheet.create({ touch: { width: 50, height: 44, justifyContent: 'center' }, track: { width: 48, height: 28, borderRadius: 14, justifyContent: 'center' }, thumb: { width: 24, height: 24, borderRadius: 12, shadowColor: '#15251F', shadowOpacity: 0.18, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 2 } });
