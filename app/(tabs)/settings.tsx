import { useCallback, useEffect, useState } from 'react';
import { Alert, AppState, Platform, StyleSheet, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
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
import { AlarmCapabilities, cancelTestAlarm, getAlarmCapabilities, openExactAlarmSettings, scheduleTestAlarm } from '@/services/nativeAlarm';
import { useAppStore } from '@/store/useAppStore';
import { AppSettings, MaximumReminders, RepeatIntervalMinutes } from '@/types';

const repeatIntervalOptions: RepeatIntervalMinutes[] = [5, 10, 15, 20, 30];
const maximumReminderOptions: MaximumReminders[] = [1, 2, 3, 4, 5];

export default function SettingsScreen() {
  const { theme } = useTheme();
  const settings = useAppStore((state) => state.settings);
  const updateSetting = useAppStore((state) => state.updateSetting);
  const refresh = useAppStore((state) => state.refresh);
  const resetAppData = useAppStore((state) => state.resetAppData);
  const resettingAppData = useAppStore((state) => state.resettingAppData);
  const [intervalOpen, setIntervalOpen] = useState(false);
  const [maximumOpen, setMaximumOpen] = useState(false);
  const [alarmCapabilities, setAlarmCapabilities] = useState<AlarmCapabilities | null>(null);
  const [testAlarmTarget, setTestAlarmTarget] = useState<number | null>(null);
  const refreshAlarmCapabilities = useCallback(async () => {
    if (Platform.OS !== 'android') return;
    try {
      setAlarmCapabilities(await getAlarmCapabilities());
    } catch {
      setAlarmCapabilities(null);
    }
  }, []);
  useFocusEffect(useCallback(() => { void refreshAlarmCapabilities(); }, [refreshAlarmCapabilities]));
  useEffect(() => {
    if (Platform.OS !== 'android') return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void refreshAlarmCapabilities();
    });
    return () => subscription.remove();
  }, [refreshAlarmCapabilities]);
  const toggle = async <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    if (resettingAppData) return;
    await updateSetting(key, value);
    if (settings.vibrationEnabled) await Haptics.selectionAsync();
    if (key === 'vibrationEnabled') await configureNotificationChannel(Boolean(value)).catch(() => undefined);
  };
  const testNotification = async () => {
    if (resettingAppData) return;
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
  const showExactAlarmSettings = async () => {
    try {
      if (!await openExactAlarmSettings()) {
        Alert.alert('Settings unavailable', 'The Alarms & reminders settings screen is not available on this device.');
      }
    } catch {
      Alert.alert('Settings unavailable', 'The Alarms & reminders settings screen could not be opened.');
    }
  };
  const scheduleNativeAlarmTest = async () => {
    if (!alarmCapabilities?.canScheduleExactAlarms) {
      Alert.alert('Exact alarm access required', 'Enable exact alarm access before scheduling the native test alarm.', [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Open Settings', onPress: () => void showExactAlarmSettings() },
      ]);
      return;
    }
    const triggerAtMillis = Date.now() + 60_000;
    try {
      const result = await scheduleTestAlarm(triggerAtMillis);
      if (!result.scheduled) {
        Alert.alert('Test alarm not scheduled', `Native scheduling refused: ${result.failureReason ?? 'unknown reason'}.`);
        return;
      }
      setTestAlarmTarget(result.triggerAtMillis);
      Alert.alert('Native test alarm scheduled', `Expected at ${new Date(result.triggerAtMillis).toLocaleTimeString()}.`);
    } catch {
      Alert.alert('Test alarm unavailable', 'The native test alarm could not be scheduled.');
    }
  };
  const cancelNativeAlarmTest = async () => {
    try {
      const cancelled = await cancelTestAlarm();
      setTestAlarmTarget(null);
      Alert.alert(cancelled ? 'Native test alarm cancelled' : 'No native test alarm found');
    } catch {
      Alert.alert('Cancellation unavailable', 'The native test alarm could not be cancelled.');
    }
  };
  const confirmReset = () => Alert.alert('Reset intake history?', 'This removes taken records only. Your vitamin schedule and settings will stay unchanged.', [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Reset', style: 'destructive', onPress: () => void resetIntakeHistory().then(refresh).then(() => Alert.alert('History reset', 'Your intake history has been cleared.')).catch(() => Alert.alert('Could not reset', 'Please try again.')) },
  ]);
  const performAppDataReset = async () => {
    try {
      setIntervalOpen(false);
      setMaximumOpen(false);
      await resetAppData();
      Alert.alert('App data has been reset.');
    } catch (error) {
      if (__DEV__) console.warn('App data reset failed', error);
      Alert.alert('Unable to reset app data', 'The reset could not be completed. Your saved data was not cleared. Please try again.');
    }
  };
  const confirmAppDataReset = () => Alert.alert(
    'Reset App Data?',
    'This will permanently remove all vitamins/supplements, reminder schedules, history, and local app data from this device. This action cannot be undone.',
    [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Reset Data', style: 'destructive', onPress: () => void performAppDataReset() },
    ],
  );
  return <Screen contentStyle={styles.content}>
    <AppHeader title="Settings" />
    <SectionLabel text="REMINDERS" />
    <View style={[styles.group, shadows.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
      <SettingRow icon="volume-medium-outline" label="Notification Sound" description="Tap to change the notification sound in Android settings." value="Device Default" disabled={resettingAppData} onPress={() => void showNotificationSettings()} />
      <SettingRow icon="phone-portrait-outline" label="Vibration" toggle toggleValue={settings.vibrationEnabled} disabled={resettingAppData} onToggle={(value) => void toggle('vibrationEnabled', value)} />
      <SettingRow icon="refresh-outline" label="Repeat if Not Taken" description="Send additional reminders until the dose is confirmed." toggle toggleValue={settings.repeatNotTakenEnabled} disabled={resettingAppData} onToggle={(value) => void toggle('repeatNotTakenEnabled', value)} />
      <SettingRow icon="timer-outline" label="Repeat Interval" value={`${settings.repeatIntervalMinutes} minutes`} disabled={resettingAppData || !settings.repeatNotTakenEnabled} onPress={() => setIntervalOpen(true)} />
      <SettingRow icon="notifications-outline" label="Maximum Reminders" description="Includes the initial scheduled reminder." value={String(settings.maximumReminders)} disabled={resettingAppData || !settings.repeatNotTakenEnabled} onPress={() => setMaximumOpen(true)} />
      {Platform.OS === 'android' && <SettingRow icon="alarm-outline" label="Exact alarm access" description={alarmCapabilities?.canScheduleExactAlarms ? undefined : 'Required for precise reminder alarms.'} value={alarmCapabilities?.canScheduleExactAlarms ? 'Enabled' : alarmCapabilities ? 'Open Settings' : 'Checking…'} disabled={resettingAppData || !alarmCapabilities} onPress={alarmCapabilities && !alarmCapabilities.canScheduleExactAlarms ? () => void showExactAlarmSettings() : undefined} last />}
    </View>
    {Platform.OS === 'android' && __DEV__ && <>
      <SectionLabel text="NATIVE ALARM TEST" />
      <View style={[styles.group, shadows.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
        <SettingRow icon="alarm-outline" label="Schedule test alarm in 1 minute" description="Temporary diagnostic: posts a native test notification." value={testAlarmTarget ? new Date(testAlarmTarget).toLocaleTimeString() : undefined} disabled={resettingAppData} onPress={() => void scheduleNativeAlarmTest()} />
        <SettingRow icon="close-circle-outline" label="Cancel test alarm" disabled={resettingAppData} onPress={() => void cancelNativeAlarmTest()} last />
      </View>
    </>}
    <SectionLabel text="APPEARANCE" />
    <View style={[styles.group, shadows.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}><SettingRow icon="moon-outline" label="Dark Mode" toggle toggleValue={settings.darkMode} disabled={resettingAppData} onToggle={(value) => void toggle('darkMode', value)} last /></View>
    <SectionLabel text="DATA & STORAGE" />
    <View style={[styles.group, shadows.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}><SettingRow icon="notifications-outline" label="Test Notification" disabled={resettingAppData} onPress={() => void testNotification()} /><SettingRow icon="trash-outline" label="Reset Intake History" danger disabled={resettingAppData} onPress={confirmReset} /><SettingRow icon="warning-outline" label="Reset App Data" description="Remove all vitamins, schedules, history, and reminder data from this device." value={resettingAppData ? 'Resetting…' : undefined} danger disabled={resettingAppData} onPress={confirmAppDataReset} last /></View>
    <SectionLabel text="ABOUT" />
    <View style={[styles.group, shadows.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}><SettingRow icon="information-circle-outline" label="About Reminder App" onPress={() => router.push('/about')} /><SettingRow icon="shield-checkmark-outline" label="Disclaimer" onPress={() => router.push('/disclaimer')} last /></View>
    <View style={styles.version}><Ionicons name="notifications-outline" size={15} color={theme.primary} /><Text style={[styles.versionText, { color: theme.muted }]}>Reminder App 1.0.0</Text></View>
    <OptionSheet visible={intervalOpen} title="Repeat Interval" options={repeatIntervalOptions} value={settings.repeatIntervalMinutes} suffix=" minutes" onSelect={(value) => void updateSetting('repeatIntervalMinutes', value)} onClose={() => setIntervalOpen(false)} />
    <OptionSheet visible={maximumOpen} title="Maximum Reminders" options={maximumReminderOptions} value={settings.maximumReminders} onSelect={(value) => void updateSetting('maximumReminders', value)} onClose={() => setMaximumOpen(false)} />
  </Screen>;
}
function SectionLabel({ text }: { text: string }) { const { theme } = useTheme(); return <Text style={[styles.section, { color: theme.textSecondary }]}>{text}</Text>; }
const styles = StyleSheet.create({ content: { paddingBottom: 30 }, section: { fontSize: 10, fontWeight: '800', letterSpacing: 1.2, marginTop: 20, marginBottom: 8, paddingLeft: 2 }, group: { borderWidth: 1, borderRadius: radius.xl, overflow: 'hidden' }, version: { marginTop: 28, flexDirection: 'row', justifyContent: 'center', alignItems: 'center', gap: 5 }, versionText: { fontSize: 10, fontWeight: '600' } });
