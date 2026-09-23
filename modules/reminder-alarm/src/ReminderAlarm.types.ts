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
