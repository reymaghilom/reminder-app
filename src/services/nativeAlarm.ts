import { Platform } from 'react-native';
import {
  cancelNativeAlarmOccurrence,
  cancelNativeAlarmOccurrences,
  cancelNativeTestAlarm,
  clearNativeAlarmRegistryCache,
  getNativeAlarmCapabilities,
  getNativeScheduledAlarmRegistry,
  openNativeExactAlarmSettings,
  scheduleNativeAlarmOccurrence,
  scheduleNativeTestAlarm,
} from '../../modules/reminder-alarm/src/ReminderAlarmModule';
import {
  AlarmCapabilities,
  NativeAlarmOccurrenceSpec,
  NativeAlarmScheduleResult,
  TestAlarmScheduleResult,
} from '../../modules/reminder-alarm/src/ReminderAlarm.types';

export type {
  AlarmCapabilities,
  NativeAlarmOccurrenceKind,
  NativeAlarmOccurrenceSpec,
  NativeAlarmScheduleResult,
  TestAlarmScheduleResult,
} from '../../modules/reminder-alarm/src/ReminderAlarm.types';

export function getAlarmCapabilities(): Promise<AlarmCapabilities> {
  if (Platform.OS !== 'android') {
    return Promise.reject(new Error('Native alarm capabilities are only available on Android.'));
  }
  return getNativeAlarmCapabilities();
}

export function openExactAlarmSettings(): Promise<boolean> {
  if (Platform.OS !== 'android') return Promise.resolve(false);
  return openNativeExactAlarmSettings();
}

export function scheduleTestAlarm(triggerAtMillis: number): Promise<TestAlarmScheduleResult> {
  if (Platform.OS !== 'android') {
    return Promise.resolve({ scheduled: false, triggerAtMillis, method: 'setAlarmClock', failureReason: 'unsupported_platform' });
  }
  return scheduleNativeTestAlarm(triggerAtMillis);
}

export function cancelTestAlarm(): Promise<boolean> {
  if (Platform.OS !== 'android') return Promise.resolve(false);
  return cancelNativeTestAlarm();
}

export function scheduleAlarmOccurrence(spec: NativeAlarmOccurrenceSpec): Promise<NativeAlarmScheduleResult> {
  if (Platform.OS !== 'android') {
    return Promise.resolve({
      scheduled: false,
      alarmKey: spec.alarmKey,
      triggerAtMillis: spec.triggerAtMillis,
      method: 'setAlarmClock',
      failureReason: 'unsupported_platform',
    });
  }
  return scheduleNativeAlarmOccurrence(spec);
}

export function cancelAlarmOccurrence(alarmKey: string): Promise<boolean> {
  if (Platform.OS !== 'android') return Promise.resolve(false);
  return cancelNativeAlarmOccurrence(alarmKey);
}

export function cancelAlarmOccurrences(alarmKeys: string[]): Promise<number> {
  if (Platform.OS !== 'android') return Promise.resolve(0);
  return cancelNativeAlarmOccurrences(alarmKeys);
}

export function getScheduledAlarmRegistry(): Promise<NativeAlarmOccurrenceSpec[]> {
  if (Platform.OS !== 'android') return Promise.resolve([]);
  return getNativeScheduledAlarmRegistry();
}

export function clearNativeAlarmRegistry(): Promise<number> {
  if (Platform.OS !== 'android') return Promise.resolve(0);
  return clearNativeAlarmRegistryCache();
}

/** Creates a reserved, non-SQLite occurrence for Phase 4 development testing. */
export function createSyntheticProductionAlarmOccurrence(triggerAtMillis: number): NativeAlarmOccurrenceSpec {
  if (!__DEV__) throw new Error('Synthetic production alarm occurrences are development-only.');
  const triggerDate = new Date(triggerAtMillis);
  const scheduledDate = [
    triggerDate.getFullYear(),
    String(triggerDate.getMonth() + 1).padStart(2, '0'),
    String(triggerDate.getDate()).padStart(2, '0'),
  ].join('-');
  const reminderId = -900001;
  return {
    alarmKey: `reminder:${reminderId}:${scheduledDate}:daily`,
    reminderId,
    scheduledDate,
    kind: 'daily',
    sequence: 1,
    triggerAtMillis,
    title: 'Reminder App Production Alarm Test',
    body: 'Synthetic native production-format alarm fired successfully.',
  };
}
