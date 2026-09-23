import { requireNativeModule } from 'expo-modules-core';
import { AlarmCapabilities, TestAlarmScheduleResult } from './ReminderAlarm.types';

interface ReminderAlarmNativeModule {
  getAlarmCapabilities(): Promise<AlarmCapabilities>;
  openExactAlarmSettings(): Promise<boolean>;
  scheduleTestAlarm(triggerAtMillis: number): Promise<TestAlarmScheduleResult>;
  cancelTestAlarm(): Promise<boolean>;
}

export function getNativeAlarmCapabilities(): Promise<AlarmCapabilities> {
  return requireNativeModule<ReminderAlarmNativeModule>('ReminderAlarm').getAlarmCapabilities();
}

export function openNativeExactAlarmSettings(): Promise<boolean> {
  return requireNativeModule<ReminderAlarmNativeModule>('ReminderAlarm').openExactAlarmSettings();
}

export function scheduleNativeTestAlarm(triggerAtMillis: number): Promise<TestAlarmScheduleResult> {
  return requireNativeModule<ReminderAlarmNativeModule>('ReminderAlarm').scheduleTestAlarm(triggerAtMillis);
}

export function cancelNativeTestAlarm(): Promise<boolean> {
  return requireNativeModule<ReminderAlarmNativeModule>('ReminderAlarm').cancelTestAlarm();
}
