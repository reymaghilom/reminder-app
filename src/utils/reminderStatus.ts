import { AppSettings, IntakeLog, Reminder, ReminderOccurrence, ReminderStatus, ReminderWithStatus } from '@/types';
import { finalReminderDateTime } from './repeatReminders';
import { scheduledDateTime } from './time';
import { dateKey } from './date';

export function getReminderStatus(reminder: Reminder, intake: IntakeLog | null, day: string, settings: AppSettings, now = new Date()): ReminderStatus {
  if (intake) return 'taken';
  if (!reminder.enabled) return 'disabled';
  if (now < scheduledDateTime(day, reminder.scheduledTime)) return 'upcoming';
  return now > finalReminderDateTime(reminder, day, settings) ? 'unconfirmed' : 'due';
}

export function combineReminders(
  reminders: Reminder[],
  intakes: IntakeLog[],
  occurrences: ReminderOccurrence[],
  day: string,
  settings: AppSettings,
  now = new Date(),
): ReminderWithStatus[] {
  const intakeByReminder = new Map(intakes.map((item) => [item.reminderId, item]));
  const occurrenceByReminder = new Map(occurrences.map((item) => [item.reminderId, item]));
  const currentDay = day === dateKey(now);
  return reminders.filter((reminder) => {
    if (currentDay && !reminder.archivedAt) return true;
    return intakeByReminder.has(reminder.id) || occurrenceByReminder.has(reminder.id);
  }).map((reminder) => {
    const intake = intakeByReminder.get(reminder.id) ?? null;
    const occurrence = occurrenceByReminder.get(reminder.id);
    const scheduledReminder = occurrence ? {
      ...reminder,
      vitaminName: occurrence.vitaminNameSnapshot,
      doseLabel: occurrence.doseLabelSnapshot,
      mealPeriod: occurrence.mealPeriodSnapshot,
      customScheduleLabel: occurrence.customScheduleLabelSnapshot,
      scheduledTime: occurrence.scheduledTimeSnapshot,
      enabled: occurrence.enabledSnapshot,
    } : reminder;
    const historicalReminder = intake ? {
      ...scheduledReminder,
      vitaminName: intake.vitaminNameSnapshot,
      doseLabel: intake.doseLabelSnapshot,
      mealPeriod: intake.mealPeriodSnapshot,
      customScheduleLabel: intake.customScheduleLabelSnapshot,
      scheduledTime: intake.scheduledTimeSnapshot,
    } : scheduledReminder;
    return { ...historicalReminder, intake, status: getReminderStatus(historicalReminder, intake, day, settings, now) };
  }).sort((a, b) => a.scheduledTime.localeCompare(b.scheduledTime) || a.sortOrder - b.sortOrder || a.id - b.id);
}
