import { AppSettings, IntakeLog, Reminder, ReminderOccurrence, ReminderStatus, ReminderWithStatus } from '@/types';
import { finalReminderDateTime } from './repeatReminders';
import { scheduledDateTime } from './time';

export function getReminderStatus(reminder: Reminder, intake: IntakeLog | null, day: string, settings: AppSettings, now = new Date()): ReminderStatus {
  if (!reminder.enabled) return 'disabled';
  if (intake) return 'taken';
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
  return reminders.map((reminder) => {
    const intake = intakeByReminder.get(reminder.id) ?? null;
    const occurrence = occurrenceByReminder.get(reminder.id);
    const scheduledReminder = occurrence ? {
      ...reminder,
      vitaminName: occurrence.vitaminNameSnapshot,
      doseLabel: occurrence.doseLabelSnapshot,
      mealPeriod: occurrence.mealPeriodSnapshot,
      scheduledTime: occurrence.scheduledTimeSnapshot,
      enabled: occurrence.enabledSnapshot,
    } : reminder;
    const historicalReminder = intake ? {
      ...scheduledReminder,
      vitaminName: intake.vitaminNameSnapshot,
      doseLabel: intake.doseLabelSnapshot,
      mealPeriod: intake.mealPeriodSnapshot,
      scheduledTime: intake.scheduledTimeSnapshot,
    } : scheduledReminder;
    return { ...historicalReminder, intake, status: getReminderStatus(historicalReminder, intake, day, settings, now) };
  });
}
