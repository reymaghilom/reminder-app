import { requireNativeModule } from 'expo-modules-core';
import {
  AlarmCapabilities,
  NativeAlarmOccurrenceSpec,
  NativeAlarmScheduleResult,
  TestAlarmScheduleResult,
} from './ReminderAlarm.types';

interface ReminderAlarmNativeModule {
  getAlarmCapabilities(): Promise<AlarmCapabilities>;
  openExactAlarmSettings(): Promise<boolean>;
  scheduleTestAlarm(triggerAtMillis: number): Promise<TestAlarmScheduleResult>;
  cancelTestAlarm(): Promise<boolean>;
  scheduleAlarmOccurrence(spec: NativeAlarmOccurrenceSpec): Promise<NativeAlarmScheduleResult>;
  cancelAlarmOccurrence(alarmKey: string): Promise<boolean>;
  cancelAlarmOccurrences(alarmKeys: string[]): Promise<number>;
  getScheduledAlarmRegistry(): Promise<NativeAlarmOccurrenceSpec[]>;
  clearNativeAlarmRegistry(): Promise<number>;
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

export function scheduleNativeAlarmOccurrence(spec: NativeAlarmOccurrenceSpec): Promise<NativeAlarmScheduleResult> {
  return requireNativeModule<ReminderAlarmNativeModule>('ReminderAlarm').scheduleAlarmOccurrence(spec);
}

export function cancelNativeAlarmOccurrence(alarmKey: string): Promise<boolean> {
  return requireNativeModule<ReminderAlarmNativeModule>('ReminderAlarm').cancelAlarmOccurrence(alarmKey);
}

export function cancelNativeAlarmOccurrences(alarmKeys: string[]): Promise<number> {
  return requireNativeModule<ReminderAlarmNativeModule>('ReminderAlarm').cancelAlarmOccurrences(alarmKeys);
}

export function getNativeScheduledAlarmRegistry(): Promise<NativeAlarmOccurrenceSpec[]> {
  return requireNativeModule<ReminderAlarmNativeModule>('ReminderAlarm').getScheduledAlarmRegistry();
}

export function clearNativeAlarmRegistryCache(): Promise<number> {
  return requireNativeModule<ReminderAlarmNativeModule>('ReminderAlarm').clearNativeAlarmRegistry();
}
