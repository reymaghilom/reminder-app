import { getDatabase } from '../database';
import { listRemindersForVitamin } from './reminders';
import { Reminder, Vitamin, VitaminInput } from '@/types';

type VitaminRow = {
  id: number; vitamin_key: string; name: string; brand: string; description: string;
  created_at: string; updated_at: string; archived_at: string | null;
};

function mapVitamin(row: VitaminRow): Vitamin {
  return {
    id: row.id, vitaminKey: row.vitamin_key, name: row.name, brand: row.brand,
    description: row.description, createdAt: row.created_at,
    updatedAt: row.updated_at, archivedAt: row.archived_at,
  };
}

export async function listVitamins(includeArchived = false): Promise<Vitamin[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<VitaminRow>(`
    SELECT * FROM vitamins ${includeArchived ? '' : 'WHERE archived_at IS NULL'}
    ORDER BY created_at ASC, id ASC`);
  return rows.map(mapVitamin);
}

export async function getVitamin(id: number): Promise<Vitamin | null> {
  const db = await getDatabase();
  const row = await db.getFirstAsync<VitaminRow>('SELECT * FROM vitamins WHERE id = ?', id);
  return row ? mapVitamin(row) : null;
}

function makeVitaminKey(): string {
  return `custom_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

export async function createVitamin(input: VitaminInput): Promise<{ vitaminId: number; reminderIds: number[] }> {
  const db = await getDatabase();
  const now = new Date().toISOString();
  const vitaminKey = makeVitaminKey();
  const reminderIds: number[] = [];
  let vitaminId = 0;
  await db.withExclusiveTransactionAsync(async (transaction) => {
    const result = await transaction.runAsync(
      `INSERT INTO vitamins (vitamin_key, name, brand, description, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
      vitaminKey, input.name, input.brand, input.description, now, now,
    );
    vitaminId = result.lastInsertRowId;
    for (const dose of input.doses) {
      const inserted = await transaction.runAsync(
        `INSERT INTO reminders
         (reminder_key, vitamin_key, vitamin_id, vitamin_name, brand, description, dose_label,
          dose_number, meal_period, custom_schedule_label, scheduled_time, enabled, sort_order, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        `${vitaminKey}_dose_${dose.doseNumber}`, vitaminKey, vitaminId, input.name, input.brand,
        input.description, `Dose ${dose.doseNumber}`, dose.doseNumber, dose.mealPeriod,
        dose.customScheduleLabel, dose.scheduledTime, dose.enabled ? 1 : 0, dose.sortOrder, now, now,
      );
      reminderIds.push(inserted.lastInsertRowId);
    }
  });
  return { vitaminId, reminderIds };
}

export async function updateVitamin(
  vitaminId: number,
  input: VitaminInput,
): Promise<{ reminderIds: number[]; archivedReminderIds: number[] }> {
  const db = await getDatabase();
  const existing = await listRemindersForVitamin(vitaminId, true);
  const existingById = new Map(existing.map((item) => [item.id, item]));
  const archivedByDose = new Map(existing.filter((item) => item.archivedAt).map((item) => [item.doseNumber, item]));
  const now = new Date().toISOString();
  const reminderIds: number[] = [];
  const keptIds = new Set<number>();

  await db.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync(
      'UPDATE vitamins SET name = ?, brand = ?, description = ?, updated_at = ? WHERE id = ? AND archived_at IS NULL',
      input.name, input.brand, input.description, now, vitaminId,
    );
    const vitamin = await transaction.getFirstAsync<{ vitamin_key: string }>('SELECT vitamin_key FROM vitamins WHERE id = ?', vitaminId);
    if (!vitamin) throw new Error('VITAMIN_NOT_FOUND');
    for (const dose of input.doses) {
      const matched: Reminder | undefined = dose.id ? existingById.get(dose.id) : archivedByDose.get(dose.doseNumber);
      if (matched) {
        await transaction.runAsync(
          `UPDATE reminders SET vitamin_name = ?, brand = ?, description = ?, dose_label = ?, dose_number = ?,
           meal_period = ?, custom_schedule_label = ?, scheduled_time = ?, enabled = ?, sort_order = ?,
           archived_at = NULL, updated_at = ? WHERE id = ? AND vitamin_id = ?`,
          input.name, input.brand, input.description, `Dose ${dose.doseNumber}`, dose.doseNumber,
          dose.mealPeriod, dose.customScheduleLabel, dose.scheduledTime, dose.enabled ? 1 : 0,
          dose.sortOrder, now, matched.id, vitaminId,
        );
        keptIds.add(matched.id);
        reminderIds.push(matched.id);
      } else {
        const inserted = await transaction.runAsync(
          `INSERT INTO reminders
           (reminder_key, vitamin_key, vitamin_id, vitamin_name, brand, description, dose_label,
            dose_number, meal_period, custom_schedule_label, scheduled_time, enabled, sort_order, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          `${vitamin.vitamin_key}_dose_${dose.doseNumber}`, vitamin.vitamin_key, vitaminId, input.name,
          input.brand, input.description, `Dose ${dose.doseNumber}`, dose.doseNumber, dose.mealPeriod,
          dose.customScheduleLabel, dose.scheduledTime, dose.enabled ? 1 : 0, dose.sortOrder, now, now,
        );
        keptIds.add(inserted.lastInsertRowId);
        reminderIds.push(inserted.lastInsertRowId);
      }
    }
    const toArchive = existing.filter((item) => !item.archivedAt && !keptIds.has(item.id));
    if (toArchive.length) {
      const placeholders = toArchive.map(() => '?').join(', ');
      await transaction.runAsync(
        `UPDATE reminders SET enabled = 0, archived_at = ?, updated_at = ? WHERE id IN (${placeholders})`,
        now, now, ...toArchive.map((item) => item.id),
      );
    }
  });
  return {
    reminderIds,
    archivedReminderIds: existing.filter((item) => !item.archivedAt && !keptIds.has(item.id)).map((item) => item.id),
  };
}

export async function archiveVitamin(vitaminId: number): Promise<number[]> {
  const vitamin = await getVitamin(vitaminId);
  if (!vitamin) throw new Error('VITAMIN_NOT_FOUND');
  const reminders = await listRemindersForVitamin(vitaminId);
  const db = await getDatabase();
  const now = new Date().toISOString();
  await db.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync('UPDATE vitamins SET archived_at = ?, updated_at = ? WHERE id = ?', now, now, vitaminId);
    await transaction.runAsync('UPDATE reminders SET enabled = 0, archived_at = ?, updated_at = ? WHERE vitamin_id = ?', now, now, vitaminId);
  });
  return reminders.map((item) => item.id);
}
