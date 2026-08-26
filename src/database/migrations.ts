import { SQLiteDatabase } from 'expo-sqlite';
import { DEFAULT_SETTINGS } from '@/constants/defaults';

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

  if (version < 4) {
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS vitamins (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        vitamin_key TEXT NOT NULL UNIQUE,
        name TEXT NOT NULL,
        brand TEXT NOT NULL DEFAULT '',
        description TEXT NOT NULL DEFAULT '',
        is_default INTEGER NOT NULL DEFAULT 0,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        archived_at TEXT
      );
      ALTER TABLE reminders ADD COLUMN vitamin_id INTEGER REFERENCES vitamins(id);
      ALTER TABLE reminders ADD COLUMN dose_number INTEGER NOT NULL DEFAULT 1;
      ALTER TABLE reminders ADD COLUMN custom_schedule_label TEXT NOT NULL DEFAULT '';
      ALTER TABLE reminders ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;
      ALTER TABLE reminders ADD COLUMN archived_at TEXT;
      ALTER TABLE intake_logs ADD COLUMN custom_schedule_label_snapshot TEXT NOT NULL DEFAULT '';
      ALTER TABLE reminder_occurrences ADD COLUMN custom_schedule_label_snapshot TEXT NOT NULL DEFAULT '';

      INSERT OR IGNORE INTO vitamins
        (vitamin_key, name, brand, description, is_default, created_at, updated_at)
      SELECT vitamin_key, vitamin_name, brand, description,
        0,
        MIN(created_at), MAX(updated_at)
      FROM reminders
      GROUP BY vitamin_key;

      UPDATE reminders
      SET vitamin_id = (SELECT id FROM vitamins WHERE vitamins.vitamin_key = reminders.vitamin_key),
          dose_number = (
            SELECT COUNT(*) FROM reminders AS earlier
            WHERE earlier.vitamin_key = reminders.vitamin_key AND earlier.id <= reminders.id
          ),
          sort_order = (
            SELECT COUNT(*) FROM reminders AS earlier
            WHERE earlier.vitamin_key = reminders.vitamin_key AND earlier.id <= reminders.id
          );

      CREATE INDEX IF NOT EXISTS idx_reminders_vitamin ON reminders(vitamin_id, archived_at, sort_order);
      CREATE UNIQUE INDEX IF NOT EXISTS idx_reminders_vitamin_dose ON reminders(vitamin_id, dose_number);
      CREATE INDEX IF NOT EXISTS idx_vitamins_active ON vitamins(archived_at, created_at);
      PRAGMA user_version = 4;
    `);
  }

  if (version < 5) {
    await db.execAsync(`
      UPDATE vitamins
      SET archived_at = COALESCE(archived_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE is_default = 1;

      UPDATE reminders
      SET enabled = 0,
          archived_at = COALESCE(archived_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
          notification_id = NULL,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE vitamin_id IN (SELECT id FROM vitamins WHERE is_default = 1);

      UPDATE reminder_occurrences
      SET enabled_snapshot = 0
      WHERE scheduled_date >= date('now', 'localtime')
        AND reminder_id IN (
          SELECT r.id
          FROM reminders r
          JOIN vitamins v ON v.id = r.vitamin_id
          WHERE v.is_default = 1
        );

      DELETE FROM scheduled_follow_ups
      WHERE reminder_id IN (
        SELECT r.id
        FROM reminders r
        JOIN vitamins v ON v.id = r.vitamin_id
        WHERE v.is_default = 1
      );

      PRAGMA user_version = 5;
    `);
  }

  if (version < 6) {
    await db.execAsync(`
      UPDATE reminders
      SET enabled = 0,
          archived_at = COALESCE(archived_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
          notification_id = NULL,
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE reminder_key IN (
        'calciumade_dose_1',
        'calciumade_dose_2',
        'heme_up_fa_daily'
      );

      UPDATE reminder_occurrences
      SET enabled_snapshot = 0
      WHERE scheduled_date >= date('now', 'localtime')
        AND reminder_id IN (
          SELECT id
          FROM reminders
          WHERE reminder_key IN (
            'calciumade_dose_1',
            'calciumade_dose_2',
            'heme_up_fa_daily'
          )
        );

      DELETE FROM scheduled_follow_ups
      WHERE reminder_id IN (
        SELECT id
        FROM reminders
        WHERE reminder_key IN (
          'calciumade_dose_1',
          'calciumade_dose_2',
          'heme_up_fa_daily'
        )
      );

      UPDATE vitamins
      SET archived_at = COALESCE(archived_at, strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
          updated_at = strftime('%Y-%m-%dT%H:%M:%fZ', 'now')
      WHERE id IN (
        SELECT DISTINCT vitamin_id
        FROM reminders
        WHERE reminder_key IN (
          'calciumade_dose_1',
          'calciumade_dose_2',
          'heme_up_fa_daily'
        )
      )
      AND NOT EXISTS (
        SELECT 1
        FROM reminders AS remaining
        WHERE remaining.vitamin_id = vitamins.id
          AND remaining.archived_at IS NULL
          AND remaining.reminder_key NOT IN (
            'calciumade_dose_1',
            'calciumade_dose_2',
            'heme_up_fa_daily'
          )
      );

      PRAGMA user_version = 6;
    `);
  }

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
      `INSERT OR IGNORE INTO settings (key, value) VALUES ${settingPlaceholders}`,
      ...settingParams,
    );
  });
}
