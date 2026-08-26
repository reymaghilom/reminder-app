import { SQLiteDatabase } from 'expo-sqlite';
import { DEFAULT_REMINDERS, DEFAULT_SETTINGS } from '@/constants/defaults';

export async function migrateDatabase(db: SQLiteDatabase): Promise<void> {
  const result = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const version = result?.user_version ?? 0;

  if (version < 1) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS reminders (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reminder_key TEXT NOT NULL UNIQUE,
        vitamin_key TEXT NOT NULL,
        vitamin_name TEXT NOT NULL,
        brand TEXT NOT NULL,
        description TEXT NOT NULL,
        dose_label TEXT NOT NULL,
        meal_period TEXT NOT NULL,
        scheduled_time TEXT NOT NULL,
        enabled INTEGER NOT NULL DEFAULT 1,
        notification_id TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE TABLE IF NOT EXISTS intake_logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        reminder_id INTEGER NOT NULL REFERENCES reminders(id),
        scheduled_date TEXT NOT NULL,
        taken_at TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'taken',
        vitamin_name_snapshot TEXT NOT NULL,
        dose_label_snapshot TEXT NOT NULL,
        meal_period_snapshot TEXT NOT NULL,
        scheduled_time_snapshot TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(reminder_id, scheduled_date)
      );
      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY NOT NULL,
        value TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_intake_logs_date ON intake_logs(scheduled_date);
      PRAGMA user_version = 1;
    `);
  }

  if (version < 2) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS scheduled_follow_ups (
        notification_id TEXT PRIMARY KEY NOT NULL,
        reminder_id INTEGER NOT NULL REFERENCES reminders(id),
        scheduled_date TEXT NOT NULL,
        sequence INTEGER NOT NULL,
        scheduled_at TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE(reminder_id, scheduled_date, sequence)
      );
      CREATE INDEX IF NOT EXISTS idx_follow_ups_dose ON scheduled_follow_ups(reminder_id, scheduled_date);
      CREATE TABLE IF NOT EXISTS reminder_occurrences (
        reminder_id INTEGER NOT NULL REFERENCES reminders(id),
        scheduled_date TEXT NOT NULL,
        vitamin_name_snapshot TEXT NOT NULL,
        dose_label_snapshot TEXT NOT NULL,
        meal_period_snapshot TEXT NOT NULL,
        scheduled_time_snapshot TEXT NOT NULL,
        enabled_snapshot INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        PRIMARY KEY(reminder_id, scheduled_date)
      );
      CREATE INDEX IF NOT EXISTS idx_reminder_occurrences_date ON reminder_occurrences(scheduled_date);
      PRAGMA user_version = 2;
    `);
  }

  if (version < 3) {
    await db.execAsync(`
      DELETE FROM settings
      WHERE key IN ('snooze_minutes', 'repeat_missed_enabled', 'sound_enabled');
      PRAGMA user_version = 3;
    `);
  }

  const now = new Date().toISOString();
  const reminderPlaceholders = DEFAULT_REMINDERS.map(() => '(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)').join(', ');
  const reminderValues = DEFAULT_REMINDERS.flatMap((reminder) => [
    reminder.reminderKey,
    reminder.vitaminKey,
    reminder.vitaminName,
    reminder.brand,
    reminder.description,
    reminder.doseLabel,
    reminder.mealPeriod,
    reminder.scheduledTime,
    reminder.enabled,
    now,
    now,
  ]);
  const settingValues: Record<string, unknown> = {
    dark_mode: DEFAULT_SETTINGS.darkMode,
    vibration_enabled: DEFAULT_SETTINGS.vibrationEnabled,
    repeat_not_taken_enabled: DEFAULT_SETTINGS.repeatNotTakenEnabled,
    repeat_interval_minutes: DEFAULT_SETTINGS.repeatIntervalMinutes,
    maximum_reminders: DEFAULT_SETTINGS.maximumReminders,
    notification_permission_asked: DEFAULT_SETTINGS.notificationPermissionAsked,
  };
  const settings = Object.entries(settingValues);
  const settingPlaceholders = settings.map(() => '(?, ?)').join(', ');
  const settingParams = settings.flatMap(([key, value]) => [key, JSON.stringify(value)]);

  await db.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync(
      `INSERT OR IGNORE INTO reminders
       (reminder_key, vitamin_key, vitamin_name, brand, description, dose_label, meal_period, scheduled_time, enabled, created_at, updated_at)
       VALUES ${reminderPlaceholders}`,
      ...reminderValues,
    );
    await transaction.runAsync(
      `INSERT OR IGNORE INTO settings (key, value) VALUES ${settingPlaceholders}`,
      ...settingParams,
    );
  });
}
