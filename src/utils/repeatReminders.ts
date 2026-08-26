import { AppSettings, Reminder } from '@/types';
import { dateKey } from './date';
import { scheduledDateTime } from './time';

export const FOLLOW_UP_HORIZON_DAYS = 14;

export function dateKeysFrom(start: Date, count: number): string[] {
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start);
    date.setDate(date.getDate() + index);
    return dateKey(date);
  });
}

export function followUpDateTime(reminder: Reminder, scheduledDate: string, sequence: number, intervalMinutes: number): Date {
  const date = scheduledDateTime(scheduledDate, reminder.scheduledTime);
  date.setMinutes(date.getMinutes() + (sequence - 1) * intervalMinutes);
  return date;
}

export function finalReminderDateTime(reminder: Reminder, scheduledDate: string, settings: AppSettings): Date {
  const maximum = settings.repeatNotTakenEnabled ? settings.maximumReminders : 1;
  return followUpDateTime(reminder, scheduledDate, maximum, settings.repeatIntervalMinutes);
}
