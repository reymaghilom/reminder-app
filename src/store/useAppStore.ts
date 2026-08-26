import { create } from 'zustand';
import { getDatabase } from '@/database/database';
import { listIntakesForDate, markReminderTaken as persistTaken } from '@/database/repositories/intakeLogs';
import { listReminderOccurrencesForDate } from '@/database/repositories/reminderOccurrences';
import { getSettings, setSetting } from '@/database/repositories/settings';
import { listReminders, updateReminder as persistReminder } from '@/database/repositories/reminders';
import { DEFAULT_SETTINGS } from '@/constants/defaults';
import { AppSettings, Reminder, ReminderWithStatus } from '@/types';
import { dateKey } from '@/utils/date';
import { combineReminders, getReminderStatus } from '@/utils/reminderStatus';
import { requestNotificationPermission } from '@/services/notifications';
import { cancelFollowUpsForDose, reconcileReminder, syncAllReminderNotifications } from '@/services/reminderScheduler';

const repeatSettingKeys: (keyof AppSettings)[] = ['repeatNotTakenEnabled', 'repeatIntervalMinutes', 'maximumReminders'];

type ReminderValues = Pick<Reminder, 'mealPeriod' | 'scheduledTime' | 'enabled'>;
type ReminderUpdateResult = { changed: boolean; notificationsSynchronized: boolean };

interface AppState {
  ready: boolean;
  error: string | null;
  reminders: Reminder[];
  todayReminders: ReminderWithStatus[];
  settings: AppSettings;
  updatingReminderIds: number[];
  initialize: () => Promise<void>;
  refresh: () => Promise<void>;
  refreshTodayStatuses: () => void;
  markTaken: (reminder: Reminder, day?: string) => Promise<boolean>;
  saveReminder: (reminderId: number, values: ReminderValues) => Promise<ReminderUpdateResult>;
  toggleReminder: (reminderId: number, enabled: boolean) => Promise<ReminderUpdateResult>;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
}

let refreshRequest = 0;
let dataMutationRevision = 0;
let notificationPermissionGranted = false;

function reminderValuesChanged(reminder: Reminder, values: ReminderValues): boolean {
  return reminder.mealPeriod !== values.mealPeriod
    || reminder.scheduledTime !== values.scheduledTime
    || reminder.enabled !== values.enabled;
}

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  error: null,
  reminders: [],
  todayReminders: [],
  settings: DEFAULT_SETTINGS,
  updatingReminderIds: [],
  initialize: async () => {
    try {
      await getDatabase();
      const settings = await getSettings();
      let granted = false;
      try {
        granted = await requestNotificationPermission(!settings.notificationPermissionAsked);
        if (!settings.notificationPermissionAsked) {
          settings.notificationPermissionAsked = true;
          await setSetting('notificationPermissionAsked', true);
        }
        await syncAllReminderNotifications(settings, granted);
      } catch (error) { if (__DEV__) console.warn('Notification setup unavailable', error); }
      notificationPermissionGranted = granted;
      set({ settings });
      await get().refresh();
      set({ ready: true });
    } catch (error) {
      if (__DEV__) console.error('MamaCare initialization failed', error);
      set({ error: 'MamaCare could not finish setting up. Please restart the app.' });
    }
  },
  refresh: async () => {
    const request = ++refreshRequest;
    const revision = dataMutationRevision;
    const day = dateKey();
    const [reminders, intakes, occurrences] = await Promise.all([
      listReminders(),
      listIntakesForDate(day),
      listReminderOccurrencesForDate(day),
    ]);
    if (request !== refreshRequest || revision !== dataMutationRevision) return;
    set((state) => ({
      reminders,
      todayReminders: combineReminders(reminders, intakes, occurrences, day, state.settings),
    }));
  },
  refreshTodayStatuses: () => set((state) => ({
    todayReminders: state.todayReminders.map((reminder) => ({
      ...reminder,
      status: getReminderStatus(reminder, reminder.intake, dateKey(), state.settings),
    })),
  })),
  markTaken: async (reminder, day = dateKey()) => {
    const result = await persistTaken(reminder, day);
    if (result.created) dataMutationRevision += 1;
    await cancelFollowUpsForDose(reminder.id, day).catch((error) => {
      if (__DEV__) console.warn('Follow-up cancellation unavailable', error);
    });
    await get().refresh();
    return result.created;
  },
  saveReminder: async (reminderId, values) => {
    if (get().updatingReminderIds.includes(reminderId)) return { changed: false, notificationsSynchronized: true };
    const previous = get().reminders.find((item) => item.id === reminderId);
    if (!previous) throw new Error('REMINDER_NOT_FOUND');
    if (!reminderValuesChanged(previous, values)) return { changed: false, notificationsSynchronized: true };

    set((state) => ({ updatingReminderIds: [...state.updatingReminderIds, reminderId] }));
    try {
      await persistReminder(reminderId, values);
      dataMutationRevision += 1;
      const updated: Reminder = { ...previous, ...values, updatedAt: new Date().toISOString() };
      set((state) => ({
        reminders: state.reminders.map((item) => item.id === reminderId ? updated : item),
        todayReminders: state.todayReminders.map((item) => {
          if (item.id !== reminderId) return item;
          const next = item.intake
            ? { ...item, enabled: updated.enabled }
            : { ...item, mealPeriod: updated.mealPeriod, scheduledTime: updated.scheduledTime, enabled: updated.enabled };
          return { ...next, status: getReminderStatus(next, next.intake, dateKey(), state.settings) };
        }),
      }));

      try {
        await reconcileReminder(reminderId, get().settings, notificationPermissionGranted);
        return { changed: true, notificationsSynchronized: true };
      } catch (error) {
        if (__DEV__) console.warn('Reminder notification synchronization unavailable', error);
        return { changed: true, notificationsSynchronized: false };
      }
    } finally {
      set((state) => ({ updatingReminderIds: state.updatingReminderIds.filter((id) => id !== reminderId) }));
    }
  },
  toggleReminder: async (reminderId, enabled) => {
    const reminder = get().reminders.find((item) => item.id === reminderId);
    if (!reminder) throw new Error('REMINDER_NOT_FOUND');
    return get().saveReminder(reminderId, {
      mealPeriod: reminder.mealPeriod,
      scheduledTime: reminder.scheduledTime,
      enabled,
    });
  },
  updateSetting: async (key, value) => {
    const previousValue = get().settings[key];
    set((state) => ({ settings: { ...state.settings, [key]: value } }));
    try {
      await setSetting(key, value);
    } catch (error) {
      if (get().settings[key] === value) {
        set((state) => ({ settings: { ...state.settings, [key]: previousValue } }));
      }
      throw error;
    }
    if (repeatSettingKeys.includes(key)) {
      try {
        await syncAllReminderNotifications(get().settings, notificationPermissionGranted);
      } catch (error) {
        if (__DEV__) console.warn('Repeat notification synchronization unavailable', error);
      }
    }
  },
}));
