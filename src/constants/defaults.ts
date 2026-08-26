import { AppSettings, MealPeriod } from '@/types';

export const MEAL_PERIODS: MealPeriod[] = ['After Breakfast', 'After Lunch', 'After Dinner', 'Bedtime', 'Custom'];

export const DEFAULT_SETTINGS: AppSettings = {
  darkMode: false,
  vibrationEnabled: true,
  repeatNotTakenEnabled: true,
  repeatIntervalMinutes: 10,
  maximumReminders: 5,
  notificationPermissionAsked: false,
};
