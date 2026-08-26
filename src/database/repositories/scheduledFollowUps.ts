import { getDatabase } from '../database';
import { ScheduledFollowUp } from '@/types';

type FollowUpRow = {
  notification_id: string;
  reminder_id: number;
  scheduled_date: string;
  sequence: number;
  scheduled_at: string;
};

const followUpColumns = 'notification_id, reminder_id, scheduled_date, sequence, scheduled_at';

function mapFollowUp(row: FollowUpRow): ScheduledFollowUp {
  return {
    notificationId: row.notification_id,
    reminderId: row.reminder_id,
    scheduledDate: row.scheduled_date,
    sequence: row.sequence,
    scheduledAt: row.scheduled_at,
  };
}

export async function listScheduledFollowUps(): Promise<ScheduledFollowUp[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<FollowUpRow>(`SELECT ${followUpColumns} FROM scheduled_follow_ups ORDER BY scheduled_at`);
  return rows.map(mapFollowUp);
}

export async function listScheduledFollowUpsForDose(reminderId: number, scheduledDate: string): Promise<ScheduledFollowUp[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<FollowUpRow>(
    `SELECT ${followUpColumns}
     FROM scheduled_follow_ups
     WHERE reminder_id = ? AND scheduled_date = ?
     ORDER BY sequence`,
    reminderId,
    scheduledDate,
  );
  return rows.map(mapFollowUp);
}

export async function listScheduledFollowUpsForReminder(reminderId: number): Promise<ScheduledFollowUp[]> {
  const db = await getDatabase();
  const rows = await db.getAllAsync<FollowUpRow>(
    `SELECT ${followUpColumns}
     FROM scheduled_follow_ups
     WHERE reminder_id = ?
     ORDER BY scheduled_at`,
    reminderId,
  );
  return rows.map(mapFollowUp);
}

export async function deleteScheduledFollowUpsForDose(reminderId: number, scheduledDate: string): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM scheduled_follow_ups WHERE reminder_id = ? AND scheduled_date = ?', reminderId, scheduledDate);
}

export async function deleteScheduledFollowUpsForReminder(reminderId: number): Promise<void> {
  const db = await getDatabase();
  await db.runAsync('DELETE FROM scheduled_follow_ups WHERE reminder_id = ?', reminderId);
}

export async function applyScheduledFollowUpChanges(
  notificationIdsToDelete: string[],
  followUpsToSave: ScheduledFollowUp[],
): Promise<void> {
  if (!notificationIdsToDelete.length && !followUpsToSave.length) return;
  const db = await getDatabase();
  await db.withExclusiveTransactionAsync(async (transaction) => {
    if (notificationIdsToDelete.length) {
      const placeholders = notificationIdsToDelete.map(() => '?').join(', ');
      await transaction.runAsync(
        `DELETE FROM scheduled_follow_ups WHERE notification_id IN (${placeholders})`,
        ...notificationIdsToDelete,
      );
    }
    for (let offset = 0; offset < followUpsToSave.length; offset += 100) {
      const batch = followUpsToSave.slice(offset, offset + 100);
      const placeholders = batch.map(() => '(?, ?, ?, ?, ?, ?)').join(', ');
      const createdAt = new Date().toISOString();
      const values = batch.flatMap((item) => [
        item.notificationId,
        item.reminderId,
        item.scheduledDate,
        item.sequence,
        item.scheduledAt,
        createdAt,
      ]);
      await transaction.runAsync(
        `INSERT INTO scheduled_follow_ups
          (notification_id, reminder_id, scheduled_date, sequence, scheduled_at, created_at)
         VALUES ${placeholders}`,
        ...values,
      );
    }
  });
}
