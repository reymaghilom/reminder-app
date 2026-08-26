export type MealPeriod = 'After Breakfast' | 'After Lunch' | 'After Dinner' | 'Bedtime' | 'Custom';
export type ReminderStatus = 'upcoming' | 'due' | 'taken' | 'unconfirmed' | 'disabled';
export type RepeatIntervalMinutes = 5 | 10 | 15 | 20 | 30;
export type MaximumReminders = 1 | 2 | 3 | 4 | 5;

export interface Reminder {
  id: number;
  reminderKey: string;
  vitaminKey: 'calciumade' | 'heme_up_fa';
  vitaminName: string;
  brand: string;
  description: string;
  doseLabel: string;
  mealPeriod: MealPeriod;
  scheduledTime: string;
  enabled: boolean;
  notificationId: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface IntakeLog {
  id: number;
  reminderId: number;
  scheduledDate: string;
  takenAt: string;
  status: 'taken';
  vitaminNameSnapshot: string;
  doseLabelSnapshot: string;
  mealPeriodSnapshot: MealPeriod;
  scheduledTimeSnapshot: string;
  createdAt: string;
}

export interface AppSettings {
  darkMode: boolean;
  vibrationEnabled: boolean;
  repeatNotTakenEnabled: boolean;
  repeatIntervalMinutes: RepeatIntervalMinutes;
  maximumReminders: MaximumReminders;
  notificationPermissionAsked: boolean;
}

export interface ReminderOccurrence {
  reminderId: number;
  scheduledDate: string;
  vitaminNameSnapshot: string;
  doseLabelSnapshot: string;
  mealPeriodSnapshot: MealPeriod;
  scheduledTimeSnapshot: string;
  enabledSnapshot: boolean;
}

export interface ScheduledFollowUp {
  notificationId: string;
  reminderId: number;
  scheduledDate: string;
  sequence: number;
  scheduledAt: string;
}

export interface ReminderWithStatus extends Reminder {
  status: ReminderStatus;
  intake: IntakeLog | null;
}
