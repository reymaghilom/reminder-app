import { Platform } from 'react-native';
import { getNativeAlarmCapabilities, openNativeExactAlarmSettings } from '../../modules/reminder-alarm/src/ReminderAlarmModule';
import { AlarmCapabilities } from '../../modules/reminder-alarm/src/ReminderAlarm.types';

export type { AlarmCapabilities };

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
