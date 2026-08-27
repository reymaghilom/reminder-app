import { DEFAULT_SETTINGS } from '@/constants/defaults';
import { AppSettings } from '@/types';
import { getDatabase } from '../database';

const reminderSettingDefaults: [string, AppSettings[keyof AppSettings]][] = [
  ['vibration_enabled', DEFAULT_SETTINGS.vibrationEnabled],
  ['repeat_not_taken_enabled', DEFAULT_SETTINGS.repeatNotTakenEnabled],
  ['repeat_interval_minutes', DEFAULT_SETTINGS.repeatIntervalMinutes],
  ['maximum_reminders', DEFAULT_SETTINGS.maximumReminders],
  ['notification_permission_asked', DEFAULT_SETTINGS.notificationPermissionAsked],
];

export async function resetStoredAppData(): Promise<AppSettings> {
  const db = await getDatabase();
  let resetSettings: AppSettings = { ...DEFAULT_SETTINGS };

  await db.withExclusiveTransactionAsync(async (transaction) => {
    const appearanceRow = await transaction.getFirstAsync<{ value: string }>(
      "SELECT value FROM settings WHERE key = 'dark_mode'",
    );
    if (appearanceRow) {
      try {
        const darkMode = JSON.parse(appearanceRow.value);
        if (typeof darkMode === 'boolean') resetSettings = { ...resetSettings, darkMode };
      } catch { /* Invalid stored appearance values safely fall back to the default. */ }
    }

    await transaction.runAsync('DELETE FROM scheduled_follow_ups');
    await transaction.runAsync('DELETE FROM intake_logs');
    await transaction.runAsync('DELETE FROM reminder_occurrences');
    await transaction.runAsync('DELETE FROM reminders');
    await transaction.runAsync('DELETE FROM vitamins');
    await transaction.runAsync('DELETE FROM settings');

    const settingValues: [string, AppSettings[keyof AppSettings]][] = [
      ['dark_mode', resetSettings.darkMode],
      ...reminderSettingDefaults,
    ];
    const settingPlaceholders = settingValues.map(() => '(?, ?)').join(', ');
    await transaction.runAsync(
      `INSERT INTO settings (key, value) VALUES ${settingPlaceholders}`,
      ...settingValues.flatMap(([key, value]) => [key, JSON.stringify(value)]),
    );
  });

  return resetSettings;
}
