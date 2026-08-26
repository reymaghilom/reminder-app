import { getDatabase } from '../database';
import { MealPeriod, Reminder } from '@/types';

type ReminderRow = {
  id: number; vitamin_id: number; reminder_key: string; vitamin_key: string; vitamin_name: string; brand: string;
  description: string; dose_label: string; dose_number: number; meal_period: MealPeriod;
  custom_schedule_label: string; scheduled_time: string; enabled: number; sort_order: number;
  archived_at: string | null; notification_id: string | null; created_at: string; updated_at: string;
};

const reminderSelect = `
  SELECT r.id, r.vitamin_id, r.reminder_key, v.vitamin_key,
    v.name AS vitamin_name, v.brand, v.description, r.dose_label, r.dose_number,
    r.meal_period, r.custom_schedule_label, r.scheduled_time, r.enabled, r.sort_order,
    COALESCE(r.archived_at, v.archived_at) AS archived_at,
    r.notification_id, r.created_at, r.updated_at
  FROM reminders r
  JOIN vitamins v ON v.id = r.vitamin_id
`;

function mapReminder(row: ReminderRow): Reminder {
  return {
    id: row.id, vitaminId: row.vitamin_id, reminderKey: row.reminder_key, vitaminKey: row.vitamin_key,
    vitaminName: row.vitamin_name, brand: row.brand, description: row.description,
    doseLabel: row.dose_label, doseNumber: row.dose_number, mealPeriod: row.meal_period,
    customScheduleLabel: row.custom_schedule_label, scheduledTime: row.scheduled_time,
    enabled: Boolean(row.enabled) && !row.archived_at, sortOrder: row.sort_order, archivedAt: row.archived_at,
    notificationId: row.notification_id, createdAt: row.created_at, updatedAt: row.updated_at,
  };
}

export async function listReminders(options: { includeArchived?: boolean } = {}): Promise<Reminder[]> {
  const db = await getDatabase();
  const where = options.includeArchived ? '' : 'WHERE r.archived_at IS NULL AND v.archived_at IS NULL';
  const rows = await db.getAllAsync<ReminderRow>(`${reminderSelect} ${where}
    ORDER BY r.scheduled_time ASC, r.sort_order ASC, r.id ASC`);
  return rows.map(mapReminder);
}

export async function listRemindersForVitamin(vitaminId: number, includeArchived = false): Promise<Reminder[]> {
  const db = await getDatabase();
  const archiveFilter = includeArchived ? '' : 'AND r.archived_at IS NULL AND v.archived_at IS NULL';
  const rows = await db.getAllAsync<ReminderRow>(`${reminderSelect}
    WHERE r.vitamin_id = ? ${archiveFilter}
    ORDER BY r.sort_order ASC, r.dose_number ASC, r.id ASC`, vitaminId);
  return rows.map(mapReminder);
}

export async function getReminder(id: number): Promise<Reminder | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<ReminderRow>(`${reminderSelect} WHERE r.id = ?`, id);
  return row ? mapReminder(row) : null;
}

export async function updateReminder(
  id: number,
  values: { mealPeriod: MealPeriod; customScheduleLabel: string; scheduledTime: string; enabled: boolean },
): Promise<void> {
  const db = await getDatabase();
  await db.runAsync(
    `UPDATE reminders SET meal_period = ?, custom_schedule_label = ?, scheduled_time = ?, enabled = ?, updated_at = ?
     WHERE id = ? AND archived_at IS NULL`,
    values.mealPeriod, values.customScheduleLabel, values.scheduledTime, values.enabled ? 1 : 0,
    new Date().toISOString(), id,
  );
}

export async function updateNotificationId(id: number, notificationId: string | null): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('UPDATE reminders SET notification_id = ?, updated_at = ? WHERE id = ?', notificationId, new Date().toISOString(), id);
}
