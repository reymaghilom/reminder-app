import { getDatabase } from '../database';
import { IntakeLog, Reminder } from '@/types';
import { scheduledDateTime } from '@/utils/time';

type IntakeRow = {
  id: number; reminder_id: number; scheduled_date: string; taken_at: string; status: 'taken';
  vitamin_name_snapshot: string; dose_label_snapshot: string; meal_period_snapshot: Reminder['mealPeriod'];
  custom_schedule_label_snapshot: string; scheduled_time_snapshot: string; created_at: string;
};

function mapIntake(row: IntakeRow): IntakeLog {
  return {
    id: row.id, reminderId: row.reminder_id, scheduledDate: row.scheduled_date, takenAt: row.taken_at,
    status: row.status, vitaminNameSnapshot: row.vitamin_name_snapshot, doseLabelSnapshot: row.dose_label_snapshot,
    mealPeriodSnapshot: row.meal_period_snapshot, customScheduleLabelSnapshot: row.custom_schedule_label_snapshot,
    scheduledTimeSnapshot: row.scheduled_time_snapshot, createdAt: row.created_at,
  };
}

export async function markReminderTaken(reminder: Reminder, scheduledDate: string): Promise<{ created: boolean; log: IntakeLog }> {
  if (!reminder.enabled) throw new Error('REMINDER_DISABLED');
  if (new Date() < scheduledDateTime(scheduledDate, reminder.scheduledTime)) throw new Error('REMINDER_NOT_DUE');
  const db = await getDatabase();
  const now = new Date().toISOString();
  const result = await db.runAsync(
    `INSERT OR IGNORE INTO intake_logs
     (reminder_id, scheduled_date, taken_at, status, vitamin_name_snapshot, dose_label_snapshot,
      meal_period_snapshot, custom_schedule_label_snapshot, scheduled_time_snapshot, created_at)
     VALUES (?, ?, ?, 'taken', ?, ?, ?, ?, ?, ?)`,
    reminder.id, scheduledDate, now, reminder.vitaminName, reminder.doseLabel, reminder.mealPeriod,
    reminder.customScheduleLabel, reminder.scheduledTime, now,
  );
  const row = await db.getFirstAsync<IntakeRow>('SELECT * FROM intake_logs WHERE reminder_id = ? AND scheduled_date = ?', reminder.id, scheduledDate);
  if (!row) throw new Error('Unable to save intake');
  return { created: result.changes > 0, log: mapIntake(row) };
}

export async function listIntakesForDate(scheduledDate: string): Promise<IntakeLog[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<IntakeRow>('SELECT * FROM intake_logs WHERE scheduled_date = ? ORDER BY scheduled_time_snapshot', scheduledDate);
  return rows.map(mapIntake);
}

export async function listIntakesForRange(start: string, end: string): Promise<IntakeLog[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<IntakeRow>('SELECT * FROM intake_logs WHERE scheduled_date BETWEEN ? AND ? ORDER BY scheduled_date, scheduled_time_snapshot', start, end);
  return rows.map(mapIntake);
}

export async function listIntakesForReminderRange(reminderId: number, start: string, end: string): Promise<IntakeLog[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<IntakeRow>(
    `SELECT * FROM intake_logs
     WHERE reminder_id = ? AND scheduled_date BETWEEN ? AND ?
     ORDER BY scheduled_date, scheduled_time_snapshot`,
    reminderId,
    start,
    end,
  );
  return rows.map(mapIntake);
}

export async function resetIntakeHistory(): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM intake_logs');
}
