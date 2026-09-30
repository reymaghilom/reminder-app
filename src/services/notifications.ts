import { Linking, Platform } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import * as IntentLauncher from 'expo-intent-launcher';
// Import only the local-notification modules. The expo-notifications barrel also
// evaluates its push-token auto-registration module, which produces a misleading
// remote-push error in Expo Go even when the app never requests a push token.
import cancelScheduledNotificationAsync from 'expo-notifications/build/cancelScheduledNotificationAsync';
import cancelAllScheduledNotificationsAsync from 'expo-notifications/build/cancelAllScheduledNotificationsAsync';
import getAllScheduledNotificationsAsync from 'expo-notifications/build/getAllScheduledNotificationsAsync';
import scheduleNotificationAsync from 'expo-notifications/build/scheduleNotificationAsync';
import setNotificationChannelAsync from 'expo-notifications/build/setNotificationChannelAsync';
import { AndroidImportance } from 'expo-notifications/build/NotificationChannelManager.types';
import { getPermissionsAsync, requestPermissionsAsync } from 'expo-notifications/build/NotificationPermissions';
import { setNotificationHandler } from 'expo-notifications/build/NotificationsHandler';
import { SchedulableTriggerInputTypes } from 'expo-notifications/build/Notifications.types';
import { Reminder } from '@/types';
import { parseTime } from '@/utils/time';

export const NOTIFICATION_CHANNEL_ID = 'vitamin-reminders';
export const NOTIFICATION_TITLE = 'Reminder';
export const NOTIFICATION_MESSAGE = 'It’s time to take your vitamin/supplement.';
let configuredVibration: boolean | null = null;

setNotificationHandler({
  handleNotification: async () => ({ shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false }),
});

export async function configureNotificationChannel(vibration = true): Promise<void> {
  if (Platform.OS !== 'android') return;
  if (configuredVibration === vibration) return;
  await setNotificationChannelAsync(NOTIFICATION_CHANNEL_ID, {
    name: 'Vitamin Reminders',
    description: 'Daily vitamin and supplement reminders from Reminder App',
    importance: AndroidImportance.HIGH,
    sound: 'default',
    vibrationPattern: vibration ? [0, 250, 150, 250] : undefined,
  });
  configuredVibration = vibration;
}

export function isExpoGoEnvironment(): boolean {
  return Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
}

function getAndroidPackageName(): string {
  return Constants.expoConfig?.android?.package ?? 'com.mamacare.reminder';
}

export async function openExpoGoSettings(): Promise<void> {
  await Linking.openSettings();
}

export async function openNotificationSettings(): Promise<'channel' | 'app-notifications' | 'app-settings'> {
  if (Platform.OS !== 'android') {
    await Linking.openSettings();
    return 'app-settings';
  }
  const packageName = getAndroidPackageName();
  if (Number(Platform.Version) >= 26) {
    try {
      await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.CHANNEL_NOTIFICATION_SETTINGS, {
        extra: {
          'android.provider.extra.APP_PACKAGE': packageName,
          'android.provider.extra.CHANNEL_ID': NOTIFICATION_CHANNEL_ID,
        },
      });
      return 'channel';
    } catch { /* Some Android variants do not expose channel-specific settings. */ }
  }
  try {
    await IntentLauncher.startActivityAsync(IntentLauncher.ActivityAction.APP_NOTIFICATION_SETTINGS, {
      extra: { 'android.provider.extra.APP_PACKAGE': packageName },
    });
    return 'app-notifications';
  } catch {
    await Linking.openSettings();
    return 'app-settings';
  }
}

export async function requestNotificationPermission(allowPrompt = true): Promise<boolean> {
  const current = await getPermissionsAsync();
  if (current.granted) return true;
  if (!allowPrompt || !current.canAskAgain) return false;
  const result = await requestPermissionsAsync();
  return result.granted;
}

export async function cancelNotification(identifier: string | null): Promise<void> {
  if (!identifier) return;
  try { await cancelScheduledNotificationAsync(identifier); } catch { /* Already removed by the OS. */ }
}

export async function cancelAllReminderNotifications(): Promise<void> {
  await cancelAllScheduledNotificationsAsync();
}

export async function scheduleReminder(reminder: Reminder): Promise<string | null> {
  if (!reminder.enabled) return null;
  const { hour, minute } = parseTime(reminder.scheduledTime);
  return scheduleNotificationAsync({
    content: {
      title: NOTIFICATION_TITLE,
      body: NOTIFICATION_MESSAGE,
      sound: 'default',
      data: { reminderId: reminder.id, kind: 'daily', scheduleSignature: notificationScheduleSignature(reminder) },
    },
    trigger: { type: SchedulableTriggerInputTypes.DAILY, hour, minute, channelId: NOTIFICATION_CHANNEL_ID },
  });
}

export function notificationScheduleSignature(reminder: Reminder): string {
  return `${reminder.vitaminName}|${reminder.doseLabel}|${reminder.scheduledTime}|${reminder.mealPeriod}|${reminder.customScheduleLabel}`;
}

export async function scheduleFollowUpNotification(
  reminder: Reminder,
  scheduledDate: string,
  sequence: number,
  maximumReminders: number,
  scheduledAt: Date,
): Promise<string> {
  return scheduleNotificationAsync({
    content: {
      title: NOTIFICATION_TITLE,
      body: NOTIFICATION_MESSAGE,
      sound: 'default',
      data: {
        reminderId: reminder.id,
        scheduledDate,
        sequence,
        maximumReminders,
        scheduledAt: scheduledAt.toISOString(),
        scheduleSignature: notificationScheduleSignature(reminder),
        kind: 'follow_up',
      },
    },
    trigger: { type: SchedulableTriggerInputTypes.DATE, date: scheduledAt, channelId: NOTIFICATION_CHANNEL_ID },
  });
}

export async function sendTestNotification(vibration = true): Promise<void> {
  await configureNotificationChannel(vibration);
  await scheduleNotificationAsync({
    content: { title: NOTIFICATION_TITLE, body: NOTIFICATION_MESSAGE, sound: 'default', data: { kind: 'test' } },
    trigger: { type: SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: 1, channelId: NOTIFICATION_CHANNEL_ID },
  });
}

export { getAllScheduledNotificationsAsync };
