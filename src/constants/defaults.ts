import { AppSettings, MealPeriod } from '@/types';

export const MEAL_PERIODS: MealPeriod[] = ['After Breakfast', 'After Lunch', 'After Dinner', 'Bedtime', 'Custom'];

export const DEFAULT_REMINDERS = [
  { reminderKey: 'calciumade_dose_1', vitaminKey: 'calciumade', vitaminName: 'Calciumade', brand: 'UNILAB', description: 'Calcium + Vitamin D3', doseLabel: 'Dose 1', mealPeriod: 'After Lunch', scheduledTime: '12:05', enabled: 1 },
  { reminderKey: 'calciumade_dose_2', vitaminKey: 'calciumade', vitaminName: 'Calciumade', brand: 'UNILAB', description: 'Calcium + Vitamin D3', doseLabel: 'Dose 2', mealPeriod: 'After Dinner', scheduledTime: '19:05', enabled: 1 },
  { reminderKey: 'heme_up_fa_daily', vitaminKey: 'heme_up_fa', vitaminName: 'Heme-Up FA', brand: 'BSV', description: 'Iron + Zinc + Folic Acid', doseLabel: 'Daily Dose', mealPeriod: 'Bedtime', scheduledTime: '21:30', enabled: 1 },
] as const;

export const DEFAULT_SETTINGS: AppSettings = {
  darkMode: false,
  vibrationEnabled: true,
  repeatNotTakenEnabled: true,
  repeatIntervalMinutes: 10,
  maximumReminders: 5,
  notificationPermissionAsked: false,
};
