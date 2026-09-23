import { requireNativeModule } from 'expo-modules-core';
import { AlarmCapabilities } from './ReminderAlarm.types';

interface ReminderAlarmNativeModule {
  getAlarmCapabilities(): Promise<AlarmCapabilities>;
}

export function getNativeAlarmCapabilities(): Promise<AlarmCapabilities> {
  return requireNativeModule<ReminderAlarmNativeModule>('ReminderAlarm').getAlarmCapabilities();
}
