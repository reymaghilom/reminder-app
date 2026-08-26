import { useMemo } from 'react';
import { Alert, Text } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { AppHeader } from '@/components/AppHeader';
import { Screen } from '@/components/Screen';
import { VitaminForm } from '@/components/VitaminForm';
import { useTheme } from '@/hooks/useTheme';
import { useAppStore } from '@/store/useAppStore';
import { VitaminInput } from '@/types';

export default function EditVitaminScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const vitaminId = Number(id);
  const { theme } = useTheme();
  const vitamins = useAppStore((state) => state.vitamins);
  const allReminders = useAppStore((state) => state.reminders);
  const vitamin = useMemo(() => vitamins.find((item) => item.id === vitaminId), [vitaminId, vitamins]);
  const reminders = useMemo(
    () => allReminders.filter((item) => item.vitaminId === vitaminId).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id),
    [allReminders, vitaminId],
  );
  const saveVitamin = useAppStore((state) => state.saveVitamin);
  const archiveVitamin = useAppStore((state) => state.archiveVitamin);
  const saving = useAppStore((state) => state.savingVitamin);

  if (!vitamin) return <Screen><AppHeader title="Edit Vitamin" back /><Text style={{ color: theme.textSecondary, textAlign: 'center', marginTop: 40 }}>Vitamin not found.</Text></Screen>;

  const submit = async (input: VitaminInput) => {
    try {
      const result = await saveVitamin(input, vitaminId);
      router.back();
      if (!result.notificationsSynchronized) setTimeout(() => Alert.alert('Vitamin saved', 'The schedule was saved, but notifications could not be fully synchronized. Reminder App will repair them at the next startup.'), 150);
    } catch (error) {
      if (__DEV__) console.warn('Edit vitamin failed', error);
      Alert.alert('Unable to save vitamin', 'Please check the schedule and try again.');
    }
  };

  const remove = () => Alert.alert(
    'Remove Vitamin?',
    'Future reminders for this vitamin will be stopped. Previous intake history will be kept.',
    [{ text: 'Cancel', style: 'cancel' }, { text: 'Remove', style: 'destructive', onPress: async () => {
      try {
        const result = await archiveVitamin(vitaminId);
        router.back();
        if (!result.notificationsSynchronized) setTimeout(() => Alert.alert('Vitamin removed', 'The vitamin was removed, but notifications could not be fully synchronized. Reminder App will repair them at the next startup.'), 150);
      } catch (error) {
        if (__DEV__) console.warn('Remove vitamin failed', error);
        Alert.alert('Unable to remove vitamin', 'Please try again.');
      }
    } }],
  );

  return <Screen contentStyle={{ paddingBottom: 36 }}><AppHeader title="Edit Vitamin" back /><VitaminForm key={vitamin.id} vitamin={vitamin} reminders={reminders} saving={saving} onSubmit={submit} onRemove={remove} /></Screen>;
}
