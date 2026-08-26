import { getDatabase } from '../database';
import { MealPeriod, Reminder } from '@/types';

type ReminderRow = {
  id: number; reminder_key: string; vitamin_key: Reminder['vitaminKey']; vitamin_name: string; brand: string;
  description: string; dose_label: string; meal_period: MealPeriod; scheduled_time: string; enabled: number;
  notification_id: string | null; created_at: string; updated_at: string;
};

function mapReminder(row: ReminderRow): Reminder {
  return {
    id: row.id, reminderKey: row.reminder_key, vitaminKey: row.vitamin_key, vitaminName: row.vitamin_name,
    brand: row.brand, description: row.description, doseLabel: row.dose_label, mealPeriod: row.meal_period,
    scheduledTime: row.scheduled_time, enabled: Boolean(row.enabled), notificationId: row.notification_id,
    createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export async function listReminders(): Promise<Reminder[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<ReminderRow>(`
    SELECT * FROM reminders
    ORDER BY
      CASE reminder_key
        WHEN 'calciumade_dose_1' THEN 1
        WHEN 'calciumade_dose_2' THEN 2
        WHEN 'heme_up_fa_daily' THEN 3
        ELSE 4
      END,
      reminder_key ASC,
      id ASC
  `);
  return rows.map(mapReminder);
}

export async function getReminder(id: number): Promise<Reminder | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<ReminderRow>('SELECT * FROM reminders WHERE id = ?', id);
  return row ? mapReminder(row) : null;
}

export async function updateReminder(id: number, values: { mealPeriod: MealPeriod; scheduledTime: string; enabled: boolean }): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    'UPDATE reminders SET meal_period = ?, scheduled_time = ?, enabled = ?, updated_at = ? WHERE id = ?',
    values.mealPeriod, values.scheduledTime, values.enabled ? 1 : 0, new Date().toISOString(), id,
  );
}

export async function updateNotificationId(id: number, notificationId: string | null): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE reminders SET notification_id = ?, updated_at = ? WHERE id = ?', notificationId, new Date().toISOString(), id);
}
