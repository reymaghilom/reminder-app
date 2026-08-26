import { getDatabase } from '../database';
import { Reminder, ReminderOccurrence } from '@/types';

type OccurrenceRow = {
  reminder_id: number;
  scheduled_date: string;
  vitamin_name_snapshot: string;
  dose_label_snapshot: string;
  meal_period_snapshot: Reminder['mealPeriod'];
  scheduled_time_snapshot: string;
  enabled_snapshot: number;
};

const occurrenceColumns = `
  reminder_id, scheduled_date, vitamin_name_snapshot, dose_label_snapshot,
  meal_period_snapshot, scheduled_time_snapshot, enabled_snapshot
`;

function mapOccurrence(row: OccurrenceRow): ReminderOccurrence {
  return {
    reminderId: row.reminder_id,
    scheduledDate: row.scheduled_date,
    vitaminNameSnapshot: row.vitamin_name_snapshot,
    doseLabelSnapshot: row.dose_label_snapshot,
    mealPeriodSnapshot: row.meal_period_snapshot,
    scheduledTimeSnapshot: row.scheduled_time_snapshot,
    enabledSnapshot: Boolean(row.enabled_snapshot),
  };
}

async function writeOccurrences(reminders: Reminder[], scheduledDates: string[], replace: boolean): Promise<void> {
  if (!reminders.length || !scheduledDates.length) return;
  const db = await getDatabase();
  const values: (string | number)[] = [];
  const placeholders: string[] = [];
  const createdAt = new Date().toISOString();
  for (const reminder of reminders) {
    for (const scheduledDate of scheduledDates) {
      placeholders.push('(?, ?, ?, ?, ?, ?, ?, ?)');
      values.push(
        reminder.id,
        scheduledDate,
        reminder.vitaminName,
        reminder.doseLabel,
        reminder.mealPeriod,
        reminder.scheduledTime,
        reminder.enabled ? 1 : 0,
        createdAt,
      );
    }
  }
  const command = replace ? `
    INSERT INTO reminder_occurrences
      (reminder_id, scheduled_date, vitamin_name_snapshot, dose_label_snapshot, meal_period_snapshot, scheduled_time_snapshot, enabled_snapshot, created_at)
    VALUES ${placeholders.join(', ')}
    ON CONFLICT(reminder_id, scheduled_date) DO UPDATE SET
      vitamin_name_snapshot = excluded.vitamin_name_snapshot,
      dose_label_snapshot = excluded.dose_label_snapshot,
      meal_period_snapshot = excluded.meal_period_snapshot,
      scheduled_time_snapshot = excluded.scheduled_time_snapshot,
      enabled_snapshot = excluded.enabled_snapshot
  ` : `
    INSERT OR IGNORE INTO reminder_occurrences
      (reminder_id, scheduled_date, vitamin_name_snapshot, dose_label_snapshot, meal_period_snapshot, scheduled_time_snapshot, enabled_snapshot, created_at)
    VALUES ${placeholders.join(', ')}
  `;
  await db.runAsync(command, ...values);
}

export async function replaceReminderOccurrences(reminder: Reminder, scheduledDates: string[]): Promise<void> {
  await writeOccurrences([reminder], scheduledDates, true);
}

export async function replaceReminderOccurrencesForReminders(reminders: Reminder[], scheduledDates: string[]): Promise<void> {
  await writeOccurrences(reminders, scheduledDates, true);
}

export async function listReminderOccurrencesForDate(scheduledDate: string): Promise<ReminderOccurrence[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<OccurrenceRow>(
    `SELECT ${occurrenceColumns}
     FROM reminder_occurrences
     WHERE scheduled_date = ?
     ORDER BY reminder_id`,
    scheduledDate,
  );
  return rows.map(mapOccurrence);
}
