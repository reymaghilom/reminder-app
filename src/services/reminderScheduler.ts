import { listIntakesForRange, listIntakesForReminderRange } from '@/database/repositories/intakeLogs';
import { replaceReminderOccurrences, replaceReminderOccurrencesForReminders } from '@/database/repositories/reminderOccurrences';
import { getReminder, listReminders, updateNotificationId } from '@/database/repositories/reminders';
import {
  applyScheduledFollowUpChanges,
  deleteScheduledFollowUpsForDose,
  deleteScheduledFollowUpsForReminder,
  listScheduledFollowUps,
  listScheduledFollowUpsForDose,
  listScheduledFollowUpsForReminder,
} from '@/database/repositories/scheduledFollowUps';
import { AppSettings, Reminder, ScheduledFollowUp } from '@/types';
import { dateKeysFrom, FOLLOW_UP_HORIZON_DAYS, followUpDateTime } from '@/utils/repeatReminders';
import {
  cancelNotification,
  configureNotificationChannel,
  getAllScheduledNotificationsAsync,
  notificationScheduleSignature,
  scheduleFollowUpNotification,
  scheduleReminder,
} from './notifications';

type ScheduledNotification = Awaited<ReturnType<typeof getAllScheduledNotificationsAsync>>[number];
type DesiredFollowUp = Omit<ScheduledFollowUp, 'notificationId'> & { reminder: Reminder };

let synchronizationQueue: Promise<void> = Promise.resolve();

function enqueueSynchronization(operation: () => Promise<void>): Promise<void> {
  const queued = synchronizationQueue.then(operation);
  synchronizationQueue = queued.catch(() => undefined);
  return queued;
}

function followUpKey(reminderId: number, scheduledDate: string, sequence: number): string {
  return `${reminderId}:${scheduledDate}:${sequence}`;
}

function devTiming(label: string, startedAt: number, details?: Record<string, number>): void {
  if (__DEV__) console.info(`[Reminder timing] ${label}: ${Date.now() - startedAt}ms`, details ?? '');
}

async function synchronizeDailyReminder(reminder: Reminder, scheduled: ScheduledNotification[]): Promise<void> {
  const daily = scheduled.filter((item) => item.content.data?.kind === 'daily'
    && Number(item.content.data?.reminderId) === reminder.id);

  if (!reminder.enabled) {
    await Promise.all(daily.map((item) => cancelNotification(item.identifier)));
    if (reminder.notificationId) await updateNotificationId(reminder.id, null);
    return;
  }

  const signature = notificationScheduleSignature(reminder);
  const matching = daily.filter((item) => item.content.data?.scheduleSignature === signature);
  const valid = matching.find((item) => item.identifier === reminder.notificationId) ?? matching[0];
  let identifier: string | null = valid?.identifier ?? null;

  await Promise.all(daily.filter((item) => item.identifier !== identifier).map((item) => cancelNotification(item.identifier)));
  if (!identifier) identifier = await scheduleReminder(reminder);
  if (identifier !== reminder.notificationId) await updateNotificationId(reminder.id, identifier);
}

async function synchronizeDailyNotifications(reminders: Reminder[], scheduled: ScheduledNotification[]): Promise<void> {
  const reminderIds = new Set(reminders.map((item) => item.id));
  const orphaned = scheduled.filter((item) => item.content.data?.kind === 'daily'
    && !reminderIds.has(Number(item.content.data?.reminderId)));
  await Promise.all(orphaned.map((item) => cancelNotification(item.identifier)));
  for (const reminder of reminders) await synchronizeDailyReminder(reminder, scheduled);
}

function calculateDesiredFollowUps(
  reminders: Reminder[],
  settings: AppSettings,
  dates: string[],
  takenDoses: Set<string>,
  now: Date,
): Map<string, DesiredFollowUp> {
  const desired = new Map<string, DesiredFollowUp>();
  if (!settings.repeatNotTakenEnabled || settings.maximumReminders <= 1) return desired;

  for (const reminder of reminders.filter((item) => item.enabled)) {
    for (const scheduledDate of dates) {
      if (takenDoses.has(`${reminder.id}:${scheduledDate}`)) continue;
      for (let sequence = 2; sequence <= settings.maximumReminders; sequence += 1) {
        const scheduledAt = followUpDateTime(reminder, scheduledDate, sequence, settings.repeatIntervalMinutes);
        if (scheduledAt <= now) continue;
        desired.set(followUpKey(reminder.id, scheduledDate, sequence), {
          reminder,
          reminderId: reminder.id,
          scheduledDate,
          sequence,
          scheduledAt: scheduledAt.toISOString(),
        });
      }
    }
  }
  return desired;
}

function matchesDesiredNotification(
  notification: ScheduledNotification | undefined,
  desired: DesiredFollowUp,
  settings: AppSettings,
): boolean {
  const data = notification?.content.data;
  return data?.kind === 'follow_up'
    && Number(data.reminderId) === desired.reminderId
    && String(data.scheduledDate) === desired.scheduledDate
    && Number(data.sequence) === desired.sequence
    && Number(data.maximumReminders) === settings.maximumReminders
    && String(data.scheduledAt) === desired.scheduledAt
    && String(data.scheduleSignature) === notificationScheduleSignature(desired.reminder);
}

async function synchronizeFollowUps(
  reminders: Reminder[],
  settings: AppSettings,
  scheduled: ScheduledNotification[],
  rows: ScheduledFollowUp[],
  intakes: Awaited<ReturnType<typeof listIntakesForRange>>,
  dates: string[],
  now: Date,
  globalCleanup: boolean,
): Promise<void> {
  const startedAt = Date.now();
  const reminderIds = new Set(reminders.map((item) => item.id));
  const takenDoses = new Set(intakes.map((item) => `${item.reminderId}:${item.scheduledDate}`));
  const desired = calculateDesiredFollowUps(reminders, settings, dates, takenDoses, now);
  const actualById = new Map(scheduled.map((item) => [item.identifier, item]));
  const rowIds = new Set(rows.map((item) => item.notificationId));
  const scopedActual = scheduled.filter((item) => item.content.data?.kind === 'follow_up'
    && (globalCleanup || reminderIds.has(Number(item.content.data?.reminderId))));
  const orphanedActual = scopedActual.filter((item) => !rowIds.has(item.identifier));
  const legacySnoozes = globalCleanup ? scheduled.filter((item) => item.content.data?.kind === 'snooze') : [];
  const validKeys = new Set<string>();
  const staleRows: ScheduledFollowUp[] = [];

  for (const row of rows) {
    const key = followUpKey(row.reminderId, row.scheduledDate, row.sequence);
    const wanted = desired.get(key);
    if (!wanted || wanted.scheduledAt !== row.scheduledAt
      || !matchesDesiredNotification(actualById.get(row.notificationId), wanted, settings)) {
      staleRows.push(row);
    } else {
      validKeys.add(key);
    }
  }

  const identifiersToCancel = [...new Set([
    ...staleRows.map((item) => item.notificationId),
    ...orphanedActual.map((item) => item.identifier),
    ...legacySnoozes.map((item) => item.identifier),
  ])];
  await Promise.all(identifiersToCancel.map(cancelNotification));

  const missing = [...desired.entries()].filter(([key]) => !validKeys.has(key));
  const results = await Promise.allSettled(missing.map(async ([, item]) => ({
    notificationId: await scheduleFollowUpNotification(
      item.reminder,
      item.scheduledDate,
      item.sequence,
      settings.maximumReminders,
      new Date(item.scheduledAt),
    ),
    reminderId: item.reminderId,
    scheduledDate: item.scheduledDate,
    sequence: item.sequence,
    scheduledAt: item.scheduledAt,
  })));
  const created = results.flatMap((result) => result.status === 'fulfilled' ? [result.value] : []);

  try {
    await applyScheduledFollowUpChanges(staleRows.map((item) => item.notificationId), created);
  } catch (error) {
    await Promise.all(created.map((item) => cancelNotification(item.notificationId)));
    throw error;
  }

  const failed = results.find((result) => result.status === 'rejected');
  devTiming('follow-up reconciliation', startedAt, {
    reminders: reminders.length,
    desired: desired.size,
    kept: validKeys.size,
    cancelled: identifiersToCancel.length,
    scheduled: created.length,
  });
  if (failed?.status === 'rejected') throw failed.reason;
}

async function performFullSynchronization(settings: AppSettings, permissionGranted: boolean): Promise<void> {
  const startedAt = Date.now();
  const reminders = await listReminders();
  const now = new Date();
  const dates = dateKeysFrom(now, FOLLOW_UP_HORIZON_DAYS);
  await replaceReminderOccurrencesForReminders(reminders, dates);
  if (!permissionGranted) return;

  await configureNotificationChannel(settings.vibrationEnabled);
  const queryStartedAt = Date.now();
  const scheduled = await getAllScheduledNotificationsAsync();
  devTiming('Expo notification query', queryStartedAt, { scheduled: scheduled.length });
  const [rows, intakes] = await Promise.all([
    listScheduledFollowUps(),
    listIntakesForRange(dates[0], dates[dates.length - 1]),
  ]);
  await synchronizeDailyNotifications(reminders, scheduled);
  await synchronizeFollowUps(reminders, settings, scheduled, rows, intakes, dates, now, true);
  devTiming('full startup reconciliation', startedAt, { reminders: reminders.length });
}

async function performReminderSynchronization(
  reminderId: number,
  settings: AppSettings,
  permissionGranted: boolean,
): Promise<void> {
  const startedAt = Date.now();
  const reminder = await getReminder(reminderId);
  if (!reminder) return;
  const now = new Date();
  const dates = dateKeysFrom(now, FOLLOW_UP_HORIZON_DAYS);
  await replaceReminderOccurrences(reminder, dates);

  if (!permissionGranted) {
    if (!reminder.enabled) {
      await deleteScheduledFollowUpsForReminder(reminder.id);
      if (reminder.notificationId) await updateNotificationId(reminder.id, null);
    }
    return;
  }

  await configureNotificationChannel(settings.vibrationEnabled);
  const queryStartedAt = Date.now();
  const scheduled = await getAllScheduledNotificationsAsync();
  devTiming('Expo notification query', queryStartedAt, { scheduled: scheduled.length });
  const [rows, intakes] = await Promise.all([
    listScheduledFollowUpsForReminder(reminder.id),
    listIntakesForReminderRange(reminder.id, dates[0], dates[dates.length - 1]),
  ]);
  await synchronizeDailyReminder(reminder, scheduled);
  await synchronizeFollowUps([reminder], settings, scheduled, rows, intakes, dates, now, false);
  devTiming('targeted reminder reconciliation', startedAt, { reminderId });
}

export function syncAllReminderNotifications(settings: AppSettings, permissionGranted: boolean): Promise<void> {
  return enqueueSynchronization(() => performFullSynchronization(settings, permissionGranted));
}

export function reconcileReminder(
  reminderId: number,
  settings: AppSettings,
  permissionGranted: boolean,
): Promise<void> {
  return enqueueSynchronization(() => performReminderSynchronization(reminderId, settings, permissionGranted));
}

export async function cancelFollowUpsForDose(reminderId: number, scheduledDate: string): Promise<void> {
  const [persisted, scheduled] = await Promise.all([
    listScheduledFollowUpsForDose(reminderId, scheduledDate),
    getAllScheduledNotificationsAsync(),
  ]);
  const matching = scheduled.filter((item) => item.content.data?.kind === 'follow_up'
    && Number(item.content.data?.reminderId) === reminderId
    && String(item.content.data?.scheduledDate) === scheduledDate);
  const identifiers = [...new Set([...persisted.map((item) => item.notificationId), ...matching.map((item) => item.identifier)])];
  await Promise.all(identifiers.map(cancelNotification));
  await deleteScheduledFollowUpsForDose(reminderId, scheduledDate);
}
