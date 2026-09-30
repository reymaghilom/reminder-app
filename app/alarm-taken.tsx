import { useEffect, useRef } from 'react';
import { Alert, Platform } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { LoadingView } from '@/components/LoadingView';
import { dismissAlarmNotifications, doseAlarmKeys } from '@/services/nativeAlarm';
import { useAppStore } from '@/store/useAppStore';

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/**
 * Target of the "Mark as taken" action on native alarm notifications
 * (mamacare://alarm-taken?reminderId=…&date=…). Records the dose through the normal store flow,
 * which also cancels the remaining follow-ups and clears the dose's alarm notifications.
 */
export default function AlarmTakenScreen() {
  const { reminderId, date } = useLocalSearchParams<{ reminderId?: string; date?: string }>();
  const markTaken = useAppStore((state) => state.markTaken);
  const handled = useRef(false);

  useEffect(() => {
    if (handled.current) return;
    handled.current = true;
    void (async () => {
      // Pressing the button is a response to the alarm, so stop it ringing even if the dose
      // cannot be recorded (not due yet, turned off, or removed).
      if (Platform.OS === 'android' && reminderId && date) {
        await dismissAlarmNotifications(doseAlarmKeys(Number(reminderId), date)).catch(() => 0);
      }
      const reminder = useAppStore.getState().reminders.find((item) => item.id === Number(reminderId));
      let title: string;
      let message: string;
      if (!reminder || !date || !DATE_PATTERN.test(date)) {
        title = 'Reminder not found';
        message = 'This reminder is no longer available.';
      } else {
        try {
          const created = await markTaken(reminder, date);
          title = created ? 'Marked as taken' : 'Already taken';
          message = created
            ? `${reminder.vitaminName} (${reminder.doseLabel}) was recorded as taken.`
            : `${reminder.vitaminName} (${reminder.doseLabel}) was already recorded for this day.`;
        } catch (error) {
          const code = error instanceof Error ? error.message : '';
          if (code === 'REMINDER_NOT_DUE') {
            title = 'Not due yet';
            message = `${reminder.vitaminName} (${reminder.doseLabel}) can be marked as taken once its scheduled time arrives.`;
          } else if (code === 'REMINDER_DISABLED') {
            title = 'Reminder is off';
            message = 'Turn this reminder on before marking it as taken.';
          } else {
            if (__DEV__) console.warn('Mark as taken from alarm failed', error);
            title = 'Could not save';
            message = 'Please mark this reminder as taken from the Home screen.';
          }
        }
      }
      router.replace('/');
      setTimeout(() => Alert.alert(title, message), 150);
    })();
  }, [date, markTaken, reminderId]);

  return <LoadingView />;
}
