import { create } from 'zustand';
import { getDatabase } from '@/database/database';
import { listIntakesForDate, markReminderTaken as persistTaken } from '@/database/repositories/intakeLogs';
import { listReminderOccurrencesForDate } from '@/database/repositories/reminderOccurrences';
import { getSettings, setSetting } from '@/database/repositories/settings';
import { listReminders, updateReminder as persistReminder } from '@/database/repositories/reminders';
import {
  archiveVitamin as persistArchiveVitamin,
  createVitamin as persistCreateVitamin,
  listVitamins,
  updateVitamin as persistVitamin,
} from '@/database/repositories/vitamins';
import { DEFAULT_SETTINGS } from '@/constants/defaults';
import { AppSettings, Reminder, ReminderWithStatus, Vitamin, VitaminInput } from '@/types';
import { dateKey } from '@/utils/date';
import { combineReminders, getReminderStatus } from '@/utils/reminderStatus';
import { requestNotificationPermission } from '@/services/notifications';
import { cancelFollowUpsForDose, reconcileReminder, syncAllReminderNotifications } from '@/services/reminderScheduler';

const repeatSettingKeys: (keyof AppSettings)[] = ['repeatNotTakenEnabled', 'repeatIntervalMinutes', 'maximumReminders'];

type ReminderValues = Pick<Reminder, 'mealPeriod' | 'customScheduleLabel' | 'scheduledTime' | 'enabled'>;
type ReminderUpdateResult = { changed: boolean; notificationsSynchronized: boolean };
type VitaminSaveResult = { vitaminId: number; notificationsSynchronized: boolean };

interface AppState {
  ready: boolean;
  error: string | null;
  reminders: Reminder[];
  vitamins: Vitamin[];
  todayReminders: ReminderWithStatus[];
  settings: AppSettings;
  updatingReminderIds: number[];
  savingVitamin: boolean;
  initialize: () => Promise<void>;
  refresh: () => Promise<void>;
  refreshTodayStatuses: () => void;
  markTaken: (reminder: Reminder, day?: string) => Promise<boolean>;
  saveReminder: (reminderId: number, values: ReminderValues) => Promise<ReminderUpdateResult>;
  toggleReminder: (reminderId: number, enabled: boolean) => Promise<ReminderUpdateResult>;
  saveVitamin: (input: VitaminInput, vitaminId?: number) => Promise<VitaminSaveResult>;
  archiveVitamin: (vitaminId: number) => Promise<{ notificationsSynchronized: boolean }>;
  updateSetting: <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => Promise<void>;
}

let refreshRequest = 0;
let dataMutationRevision = 0;
let notificationPermissionGranted = false;

function reminderValuesChanged(reminder: Reminder, values: ReminderValues): boolean {
  return reminder.mealPeriod !== values.mealPeriod
    || reminder.customScheduleLabel !== values.customScheduleLabel
    || reminder.scheduledTime !== values.scheduledTime
    || reminder.enabled !== values.enabled;
}

export const useAppStore = create<AppState>((set, get) => ({
  ready: false,
  error: null,
  reminders: [],
  vitamins: [],
  todayReminders: [],
  settings: DEFAULT_SETTINGS,
  updatingReminderIds: [],
  savingVitamin: false,
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
      if (__DEV__) console.error('Reminder App initialization failed', error);
      set({ error: 'Reminder App could not finish setting up. Please restart the app.' });
    }
  },
  refresh: async () => {
    const request = ++refreshRequest;
    const revision = dataMutationRevision;
    const day = dateKey();
    const [vitamins, reminders, intakes, occurrences] = await Promise.all([
      listVitamins(),
      listReminders(),
      listIntakesForDate(day),
      listReminderOccurrencesForDate(day),
    ]);
    if (request !== refreshRequest || revision !== dataMutationRevision) return;
    set((state) => ({
      vitamins, reminders,
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
            : { ...item, mealPeriod: updated.mealPeriod, customScheduleLabel: updated.customScheduleLabel, scheduledTime: updated.scheduledTime, enabled: updated.enabled };
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
      customScheduleLabel: reminder.customScheduleLabel,
      scheduledTime: reminder.scheduledTime,
      enabled,
    });
  },
  saveVitamin: async (input, vitaminId) => {
    if (get().savingVitamin) throw new Error('SAVE_IN_PROGRESS');
    set({ savingVitamin: true });
    try {
      const previous = vitaminId ? get().reminders.filter((item) => item.vitaminId === vitaminId) : [];
      let savedVitaminId: number;
      if (vitaminId) {
        await persistVitamin(vitaminId, input);
        savedVitaminId = vitaminId;
      } else {
        const created = await persistCreateVitamin(input);
        savedVitaminId = created.vitaminId;
      }
      dataMutationRevision += 1;
      await get().refresh();
      const current = get().reminders.filter((item) => item.vitaminId === savedVitaminId);
      const previousById = new Map(previous.map((item) => [item.id, item]));
      const affected = new Set<number>(
        current.filter((item) => {
          const old = previousById.get(item.id);
          return !old || old.vitaminName !== item.vitaminName || old.doseLabel !== item.doseLabel
            || old.mealPeriod !== item.mealPeriod || old.customScheduleLabel !== item.customScheduleLabel
            || old.scheduledTime !== item.scheduledTime || old.enabled !== item.enabled;
        }).map((item) => item.id),
      );
      for (const old of previous) if (!current.some((item) => item.id === old.id)) affected.add(old.id);
      let notificationsSynchronized = true;
      for (const reminderId of affected) {
        try { await reconcileReminder(reminderId, get().settings, notificationPermissionGranted); }
        catch (error) {
          notificationsSynchronized = false;
          if (__DEV__) console.warn('Vitamin notification synchronization unavailable', error);
        }
      }
      return { vitaminId: savedVitaminId, notificationsSynchronized };
    } finally {
      set({ savingVitamin: false });
    }
  },
  archiveVitamin: async (vitaminId) => {
    if (get().savingVitamin) throw new Error('SAVE_IN_PROGRESS');
    set({ savingVitamin: true });
    try {
      const reminderIds = await persistArchiveVitamin(vitaminId);
      dataMutationRevision += 1;
      await get().refresh();
      let notificationsSynchronized = true;
      for (const reminderId of reminderIds) {
        try { await reconcileReminder(reminderId, get().settings, notificationPermissionGranted); }
        catch (error) {
          notificationsSynchronized = false;
          if (__DEV__) console.warn('Archived reminder synchronization unavailable', error);
        }
      }
      return { notificationsSynchronized };
    } finally {
      set({ savingVitamin: false });
    }
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
