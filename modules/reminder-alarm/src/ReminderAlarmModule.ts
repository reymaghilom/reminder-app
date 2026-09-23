import { requireNativeModule } from 'expo-modules-core';
import { AlarmCapabilities } from './ReminderAlarm.types';

interface ReminderAlarmNativeModule {
  getAlarmCapabilities(): Promise<AlarmCapabilities>;
  openExactAlarmSettings(): Promise<boolean>;
}

export function getNativeAlarmCapabilities(): Promise<AlarmCapabilities> {
  return requireNativeModule<ReminderAlarmNativeModule>('ReminderAlarm').getAlarmCapabilities();
}

export function openNativeExactAlarmSettings(): Promise<boolean> {
  return requireNativeModule<ReminderAlarmNativeModule>('ReminderAlarm').openExactAlarmSettings();
}
