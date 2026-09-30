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
import { Platform } from 'react-native';
import { AppSettings, Reminder, ScheduledFollowUp } from '@/types';
import { dateKeysFrom, FOLLOW_UP_HORIZON_DAYS, followUpDateTime } from '@/utils/repeatReminders';
import { scheduledDateTime } from '@/utils/time';
import {
  cancelAlarmOccurrences,
  clearNativeAlarmRegistry,
  dismissAlarmNotifications,
  isNativeAlarmDeliveryAvailable,
  nativeAlarmKey,
  NativeAlarmOccurrenceKind,
  NativeAlarmOccurrenceSpec,
  synchronizeAlarmOccurrences,
} from './nativeAlarm';
import {
  cancelAllReminderNotifications,
  cancelNotification,
  configureNotificationChannel,
  getAllScheduledNotificationsAsync,
  isExpoGoEnvironment,
  NOTIFICATION_MESSAGE,
  NOTIFICATION_TITLE,
  notificationScheduleSignature,
  scheduleFollowUpNotification,
  scheduleReminder,
} from './notifications';

type ScheduledNotification = Awaited<ReturnType<typeof getAllScheduledNotificationsAsync>>[number];
type DesiredFollowUp = Omit<ScheduledFollowUp, 'notificationId'> & { reminder: Reminder };
type IntakeRange = Awaited<ReturnType<typeof listIntakesForRange>>;

/** Stays well under Android's 500 concurrent alarms per app; the nearest occurrences win. */
const NATIVE_ALARM_BUDGET = 400;
/** Kotlin rejects triggers that are not in the future, so skip anything about to fire. */
const NATIVE_ALARM_MIN_LEAD_MS = 5_000;
/** Native alarms are one-shot, so the 14-day window is topped up when the app returns to the foreground. */
const FOREGROUND_RESYNC_INTERVAL_MS = 6 * 60 * 60 * 1000;
const MAX_FOLLOW_UP_SEQUENCE = 5;

let synchronizationQueue: Promise<void> = Promise.resolve();
let lastFullSynchronization: { at: number; nativeMode: boolean } | null = null;

function enqueueSynchronization<T>(operation: () => Promise<T>): Promise<T> {
  const queued = synchronizationQueue.then(operation);
  synchronizationQueue = queued.then(() => undefined).catch(() => undefined);
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

function calculateDesiredNativeAlarms(
  reminders: Reminder[],
  settings: AppSettings,
  dates: string[],
  takenDoses: Set<string>,
  now: Date,
): NativeAlarmOccurrenceSpec[] {
  const earliest = now.getTime() + NATIVE_ALARM_MIN_LEAD_MS;
  const specs: NativeAlarmOccurrenceSpec[] = [];
  const add = (reminderId: number, scheduledDate: string, kind: NativeAlarmOccurrenceKind, sequence: number, at: Date) => {
    if (at.getTime() <= earliest) return;
    specs.push({
      alarmKey: nativeAlarmKey(reminderId, scheduledDate, kind, sequence),
      reminderId,
      scheduledDate,
      kind,
      sequence,
      triggerAtMillis: at.getTime(),
      title: NOTIFICATION_TITLE,
      body: NOTIFICATION_MESSAGE,
      vibrate: settings.vibrationEnabled,
    });
  };

  for (const reminder of reminders.filter((item) => item.enabled)) {
    for (const scheduledDate of dates) {
      if (takenDoses.has(`${reminder.id}:${scheduledDate}`)) continue;
      add(reminder.id, scheduledDate, 'daily', 1, scheduledDateTime(scheduledDate, reminder.scheduledTime));
    }
  }
  for (const item of calculateDesiredFollowUps(reminders, settings, dates, takenDoses, now).values()) {
    add(item.reminderId, item.scheduledDate, 'follow_up', item.sequence, new Date(item.scheduledAt));
  }
  return specs.sort((a, b) => a.triggerAtMillis - b.triggerAtMillis).slice(0, NATIVE_ALARM_BUDGET);
}

/** Returns false when exact-alarm access disappeared, so the caller falls back to Expo notifications. */
async function synchronizeNativeAlarms(
  reminders: Reminder[],
  settings: AppSettings,
  intakes: IntakeRange,
  dates: string[],
  now: Date,
): Promise<boolean> {
  const startedAt = Date.now();
  const takenDoses = new Set(intakes.map((item) => `${item.reminderId}:${item.scheduledDate}`));
  const specs = calculateDesiredNativeAlarms(reminders, settings, dates, takenDoses, now);
  const result = await synchronizeAlarmOccurrences(specs, [], true);
  devTiming('native alarm reconciliation', startedAt, {
    desired: specs.length,
    scheduled: result.scheduled,
    cancelled: result.cancelled,
    failed: result.failures.length,
  });
  if (!result.exactAlarmAccess) return false;
  if (result.failures.length) {
    throw new Error(`Native alarm synchronization failed: ${result.failures[0].failureReason}`);
  }
  return true;
}

/** Native alarms replace Expo delivery, so remove the Expo copies to avoid duplicate alerts. */
async function removeExpoReminderDelivery(
  reminders: Reminder[],
  scheduled: ScheduledNotification[],
  rows: ScheduledFollowUp[],
  globalCleanup: boolean,
): Promise<void> {
  const reminderIds = new Set(reminders.map((item) => item.id));
  const expo = scheduled.filter((item) => {
    const kind = item.content.data?.kind;
    if (kind === 'snooze') return globalCleanup;
    return (kind === 'daily' || kind === 'follow_up')
      && (globalCleanup || reminderIds.has(Number(item.content.data?.reminderId)));
  });
  await Promise.all(expo.map((item) => cancelNotification(item.identifier)));
  if (rows.length) await applyScheduledFollowUpChanges(rows.map((item) => item.notificationId), []);
  for (const reminder of reminders) {
    if (reminder.notificationId) await updateNotificationId(reminder.id, null);
  }
}

function nativeAlarmsSupported(): boolean {
  return Platform.OS === 'android' && !isExpoGoEnvironment();
}

async function clearNativeReminderAlarms(): Promise<void> {
  if (nativeAlarmsSupported()) await clearNativeAlarmRegistry();
}

async function performFullSynchronization(settings: AppSettings, permissionGranted: boolean): Promise<void> {
  const startedAt = Date.now();
  const reminders = await listReminders();
  const now = new Date();
  const dates = dateKeysFrom(now, FOLLOW_UP_HORIZON_DAYS);
  await replaceReminderOccurrencesForReminders(reminders, dates);
  if (!permissionGranted) return;

  const nativeMode = await isNativeAlarmDeliveryAvailable();
  await configureNotificationChannel(settings.vibrationEnabled);
  const queryStartedAt = Date.now();
  const scheduled = await getAllScheduledNotificationsAsync();
  devTiming('Expo notification query', queryStartedAt, { scheduled: scheduled.length });
  const [rows, intakes] = await Promise.all([
    listScheduledFollowUps(),
    listIntakesForRange(dates[0], dates[dates.length - 1]),
  ]);

  if (nativeMode && await synchronizeNativeAlarms(reminders, settings, intakes, dates, now)) {
    await removeExpoReminderDelivery(reminders, scheduled, rows, true);
    lastFullSynchronization = { at: Date.now(), nativeMode: true };
    devTiming('full startup reconciliation (native)', startedAt, { reminders: reminders.length });
    return;
  }

  await clearNativeReminderAlarms();
  await synchronizeDailyNotifications(reminders, scheduled);
  await synchronizeFollowUps(reminders, settings, scheduled, rows, intakes, dates, now, true);
  lastFullSynchronization = { at: Date.now(), nativeMode: false };
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

  // Delivery mode is device-wide; if it changed since the last full pass, every reminder must move over.
  const nativeMode = await isNativeAlarmDeliveryAvailable();
  if (!lastFullSynchronization || lastFullSynchronization.nativeMode !== nativeMode) {
    await performFullSynchronization(settings, permissionGranted);
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

  if (nativeMode) {
    // The alarm budget is shared by all reminders, so native alarms are always derived as a whole.
    const [allReminders, allIntakes] = await Promise.all([
      listReminders(),
      listIntakesForRange(dates[0], dates[dates.length - 1]),
    ]);
    if (await synchronizeNativeAlarms(allReminders, settings, allIntakes, dates, now)) {
      await removeExpoReminderDelivery([reminder], scheduled, rows, false);
      devTiming('targeted reminder reconciliation (native)', startedAt, { reminderId });
      return;
    }
    await performFullSynchronization(settings, permissionGranted);
    return;
  }

  await synchronizeDailyReminder(reminder, scheduled);
  await synchronizeFollowUps([reminder], settings, scheduled, rows, intakes, dates, now, false);
  devTiming('targeted reminder reconciliation', startedAt, { reminderId });
}

export function syncAllReminderNotifications(settings: AppSettings, permissionGranted: boolean): Promise<void> {
  return enqueueSynchronization(() => performFullSynchronization(settings, permissionGranted));
}

export function resetReminderNotificationsAndData<T>(resetData: () => Promise<T>): Promise<T> {
  return enqueueSynchronization(async () => {
    await cancelAllReminderNotifications();
    await clearNativeReminderAlarms();
    return resetData();
  });
}

/** Tops up the one-shot native alarm window and follows exact-alarm access changes made in Settings. */
export function refreshReminderDeliveryIfStale(settings: AppSettings, permissionGranted: boolean): Promise<void> {
  return enqueueSynchronization(async () => {
    if (!permissionGranted || !lastFullSynchronization) return;
    const nativeMode = await isNativeAlarmDeliveryAvailable();
    if (nativeMode === lastFullSynchronization.nativeMode
      && Date.now() - lastFullSynchronization.at < FOREGROUND_RESYNC_INTERVAL_MS) return;
    await performFullSynchronization(settings, permissionGranted);
  });
}

export function reconcileReminder(
  reminderId: number,
  settings: AppSettings,
  permissionGranted: boolean,
): Promise<void> {
  return enqueueSynchronization(() => performReminderSynchronization(reminderId, settings, permissionGranted));
}

async function performDoseFollowUpCancellation(reminderId: number, scheduledDate: string): Promise<void> {
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

  if (nativeAlarmsSupported()) {
    const sequences = Array.from({ length: MAX_FOLLOW_UP_SEQUENCE - 1 }, (_, index) => index + 2);
    const alarmKeys = [
      nativeAlarmKey(reminderId, scheduledDate, 'daily', 1),
      ...sequences.map((sequence) => nativeAlarmKey(reminderId, scheduledDate, 'follow_up', sequence)),
    ];
    await cancelAlarmOccurrences(alarmKeys);
    await dismissAlarmNotifications(alarmKeys);
  }
}

export function cancelFollowUpsForDose(reminderId: number, scheduledDate: string): Promise<void> {
  return enqueueSynchronization(() => performDoseFollowUpCancellation(reminderId, scheduledDate));
}
