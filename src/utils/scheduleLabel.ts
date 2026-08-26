import { MealPeriod } from '@/types';

export function scheduleLabel(mealPeriod: MealPeriod, customScheduleLabel: string): string {
  return mealPeriod === 'Custom' ? customScheduleLabel.trim() || 'Custom schedule' : mealPeriod;
}
