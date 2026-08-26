import { useState } from 'react';
import { Alert, StyleSheet, Text, View } from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Screen } from '@/components/Screen';
import { AppHeader } from '@/components/AppHeader';
import { SettingRow } from '@/components/SettingRow';
import { OptionSheet } from '@/components/OptionSheet';
import { radius, shadows } from '@/constants/theme';
import { resetIntakeHistory } from '@/database/repositories/intakeLogs';
import { useTheme } from '@/hooks/useTheme';
import { configureNotificationChannel, isExpoGoEnvironment, openExpoGoSettings, openNotificationSettings, requestNotificationPermission, sendTestNotification } from '@/services/notifications';
import { useAppStore } from '@/store/useAppStore';
import { AppSettings, MaximumReminders, RepeatIntervalMinutes } from '@/types';

const repeatIntervalOptions: RepeatIntervalMinutes[] = [5, 10, 15, 20, 30];
const maximumReminderOptions: MaximumReminders[] = [1, 2, 3, 4, 5];

export default function SettingsScreen() {
  const { theme } = useTheme();
  const settings = useAppStore((state) => state.settings);
  const updateSetting = useAppStore((state) => state.updateSetting);
  const refresh = useAppStore((state) => state.refresh);
  const [intervalOpen, setIntervalOpen] = useState(false);
  const [maximumOpen, setMaximumOpen] = useState(false);
  const toggle = async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    await updateSetting(key, value);
    if (settings.vibrationEnabled) await Haptics.selectionAsync();
    if (key === 'vibrationEnabled') await configureNotificationChannel(Boolean(value)).catch(() => undefined);
  };
  const testNotification = async () => {
    try {
      const granted = await requestNotificationPermission();
      if (!granted) return Alert.alert('Notifications are off', 'Enable notifications for Reminder App in your device settings, then try again.');
      await sendTestNotification(settings.vibrationEnabled);
      Alert.alert('Test sent', 'A Reminder App test notification was sent.');
    } catch { Alert.alert('Test unavailable', 'The test notification could not be sent on this device.'); }
  };
  const showNotificationSettings = async () => {
    if (isExpoGoEnvironment()) {
      Alert.alert(
        'Notification Sound',
        "While testing in Expo Go, notification sound is managed by Android's settings for Expo Go. The installed Reminder App will have its own notification settings.",
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Open Expo Go Settings',
            onPress: () => void openExpoGoSettings().catch(() => {
              Alert.alert('Settings unavailable', 'Open Android Settings, select Apps, then select Expo Go to change its notification preferences.');
            }),
          },
        ],
      );
      return;
    }
    try {
      await configureNotificationChannel(settings.vibrationEnabled);
      await openNotificationSettings();
    } catch {
      Alert.alert('Settings unavailable', 'Open Android Settings, select Apps, then select Reminder App to change its notification preferences.');
    }
  };
  const confirmReset = () => Alert.alert('Reset intake history?', 'This removes taken records only. Your vitamin schedule and settings will stay unchanged.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Reset', style: 'destructive', onPress: () => void resetIntakeHistory().then(refresh).then(() => Alert.alert('History reset', 'Your intake history has been cleared.')).catch(() => Alert.alert('Could not reset', 'Please try again.')) },
  ]);
  return <Screen contentStyle={styles.content}>
    <AppHeader title="Settings" />
    <SectionLabel text="REMINDERS" />
    <View style={[styles.group, shadows.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
      <SettingRow icon="volume-medium-outline" label="Notification Sound" description="Tap to change the notification sound in Android settings." value="Device Default" onPress={() => void showNotificationSettings()} />
      <SettingRow icon="phone-portrait-outline" label="Vibration" toggle toggleValue={settings.vibrationEnabled} onToggle={(value) => void toggle('vibrationEnabled', value)} />
      <SettingRow icon="refresh-outline" label="Repeat if Not Taken" description="Send additional reminders until the dose is confirmed." toggle toggleValue={settings.repeatNotTakenEnabled} onToggle={(value) => void toggle('repeatNotTakenEnabled', value)} />
      <SettingRow icon="timer-outline" label="Repeat Interval" value={`${settings.repeatIntervalMinutes} minutes`} disabled={!settings.repeatNotTakenEnabled} onPress={() => setIntervalOpen(true)} />
      <SettingRow icon="notifications-outline" label="Maximum Reminders" description="Includes the initial scheduled reminder." value={String(settings.maximumReminders)} disabled={!settings.repeatNotTakenEnabled} onPress={() => setMaximumOpen(true)} last />
    </View>
    <SectionLabel text="APPEARANCE" />
    <View style={[styles.group, shadows.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}><SettingRow icon="moon-outline" label="Dark Mode" toggle toggleValue={settings.darkMode} onToggle={(value) => void toggle('darkMode', value)} last /></View>
    <SectionLabel text="DATA" />
    <View style={[styles.group, shadows.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}><SettingRow icon="notifications-outline" label="Test Notification" onPress={() => void testNotification()} /><SettingRow icon="trash-outline" label="Reset Intake History" danger onPress={confirmReset} last /></View>
    <SectionLabel text="ABOUT" />
    <View style={[styles.group, shadows.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}><SettingRow icon="information-circle-outline" label="About Reminder App" onPress={() => router.push('/about')} /><SettingRow icon="shield-checkmark-outline" label="Disclaimer" onPress={() => router.push('/disclaimer')} last /></View>
    <View style={styles.version}><Ionicons name="notifications-outline" size={15} color={theme.primary} /><Text style={[styles.versionText, { color: theme.muted }]}>Reminder App 1.0.0</Text></View>
    <OptionSheet visible={intervalOpen} title="Repeat Interval" options={repeatIntervalOptions} value={settings.repeatIntervalMinutes} suffix=" minutes" onSelect={(value) => void updateSetting('repeatIntervalMinutes', value)} onClose={() => setIntervalOpen(false)} />
    <OptionSheet visible={maximumOpen} title="Maximum Reminders" options={maximumReminderOptions} value={settings.maximumReminders} onSelect={(value) => void updateSetting('maximumReminders', value)} onClose={() => setMaximumOpen(false)} />
  </Screen>;
}
function SectionLabel({ text }: { text: string }) { const { theme } = useTheme(); return <Text style={[styles.section, { color: theme.textSecondary }]}>{text}</Text>; }
const styles = StyleSheet.create({ content: { paddingBottom: 30 }, section: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginTop: 20, marginBottom: 8, paddingLeft: 2 }, group: { borderWidth: 1, borderRadius: radius.xl, overflow: 'hidden' }, version: { marginTop: 28, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5 }, versionText: { fontSize: 10, fontWeight: '600' } });
