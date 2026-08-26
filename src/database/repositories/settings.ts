import { DEFAULT_SETTINGS } from '@/constants/defaults';
import { AppSettings } from '@/types';
import { getDatabase } from '../database';

const keyMap: Record<keyof AppSettings, string> = {
  darkMode: 'dark_mode', vibrationEnabled: 'vibration_enabled',
  repeatNotTakenEnabled: 'repeat_not_taken_enabled', repeatIntervalMinutes: 'repeat_interval_minutes',
  maximumReminders: 'maximum_reminders', notificationPermissionAsked: 'notification_permission_asked',
};

export async function getSettings(): Promise<AppSettings> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<{ key: string; value: string }>('SELECT key, value FROM settings');
  const values = Object.fromEntries(rows.map((row) => [row.key, JSON.parse(row.value)]));
  return {
    darkMode: values.dark_mode ?? DEFAULT_SETTINGS.darkMode,
    vibrationEnabled: values.vibration_enabled ?? DEFAULT_SETTINGS.vibrationEnabled,
    repeatNotTakenEnabled: values.repeat_not_taken_enabled ?? DEFAULT_SETTINGS.repeatNotTakenEnabled,
    repeatIntervalMinutes: values.repeat_interval_minutes ?? DEFAULT_SETTINGS.repeatIntervalMinutes,
    maximumReminders: values.maximum_reminders ?? DEFAULT_SETTINGS.maximumReminders,
    notificationPermissionAsked: values.notification_permission_asked ?? DEFAULT_SETTINGS.notificationPermissionAsked,
  };
}

export async function setSetting<K extends keyof AppSettings>(key: K, value: AppSettings[K]): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)', keyMap[key], JSON.stringify(value));
}
