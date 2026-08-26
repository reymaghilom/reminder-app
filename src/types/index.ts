export type MealPeriod = 'After Breakfast' | 'After Lunch' | 'After Dinner' | 'Bedtime' | 'Custom';
export type ReminderStatus = 'upcoming' | 'due' | 'taken' | 'unconfirmed' | 'disabled';
export type RepeatIntervalMinutes = 5 | 10 | 15 | 20 | 30;
export type MaximumReminders = 1 | 2 | 3 | 4 | 5;

export interface Vitamin {
  id: number;
  vitaminKey: string;
  name: string;
  brand: string;
  description: string;
  createdAt: string;
  updatedAt: string;
  archivedAt: string | null;
}

export interface DoseScheduleInput {
  id?: number;
  doseNumber: number;
  mealPeriod: MealPeriod;
  customScheduleLabel: string;
  scheduledTime: string;
  enabled: boolean;
  sortOrder: number;
}

export interface VitaminInput {
  name: string;
  brand: string;
  description: string;
  doses: DoseScheduleInput[];
}

export interface Reminder {
  id: number;
  vitaminId: number;
  reminderKey: string;
  vitaminKey: string;
  vitaminName: string;
  brand: string;
  description: string;
  doseLabel: string;
  doseNumber: number;
  mealPeriod: MealPeriod;
  customScheduleLabel: string;
  scheduledTime: string;
  enabled: boolean;
  sortOrder: number;
  archivedAt: string | null;
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
  customScheduleLabelSnapshot: string;
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
  customScheduleLabelSnapshot: string;
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
