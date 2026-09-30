export interface AlarmCapabilities {
  platform: 'android';
  apiLevel: number;
  exactAlarmSupported: boolean;
  canScheduleExactAlarms: boolean;
}

export interface TestAlarmScheduleResult {
  scheduled: boolean;
  triggerAtMillis: number;
  method: 'setAlarmClock';
  failureReason: string | null;
}

export type NativeAlarmOccurrenceKind = 'daily' | 'follow_up';

/** Derived scheduling state; SQLite/Zustand remain authoritative. */
export interface NativeAlarmOccurrenceSpec {
  alarmKey: string;
  reminderId: number;
  scheduledDate: string;
  kind: NativeAlarmOccurrenceKind;
  sequence: number;
  triggerAtMillis: number;
  title: string;
  body: string;
  /** Defaults to true in Kotlin, which also keeps older registry entries readable. */
  vibrate?: boolean;
}

export interface NativeAlarmSynchronizationResult {
  scheduled: number;
  cancelled: number;
  failures: { alarmKey: string; failureReason: string }[];
  exactAlarmAccess: boolean;
}

export interface NativeAlarmScheduleResult {
  scheduled: boolean;
  alarmKey: string;
  triggerAtMillis: number;
  method: 'setAlarmClock';
  failureReason: string | null;
}
