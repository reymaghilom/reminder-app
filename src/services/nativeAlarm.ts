import { Platform } from 'react-native';
import { cancelNativeTestAlarm, getNativeAlarmCapabilities, openNativeExactAlarmSettings, scheduleNativeTestAlarm } from '../../modules/reminder-alarm/src/ReminderAlarmModule';
import { AlarmCapabilities, TestAlarmScheduleResult } from '../../modules/reminder-alarm/src/ReminderAlarm.types';

export type { AlarmCapabilities, TestAlarmScheduleResult };

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
