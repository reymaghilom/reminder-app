import { Alert } from 'react-native';
import { router } from 'expo-router';
import { AppHeader } from '@/components/AppHeader';
import { Screen } from '@/components/Screen';
import { VitaminForm } from '@/components/VitaminForm';
import { useAppStore } from '@/store/useAppStore';
import { VitaminInput } from '@/types';

export default function AddVitaminScreen() {
  const saveVitamin = useAppStore((state) => state.saveVitamin);
  const saving = useAppStore((state) => state.savingVitamin);
  const submit = async (input: VitaminInput) => {
    try {
      const result = await saveVitamin(input);
      router.back();
      if (!result.notificationsSynchronized) setTimeout(() => Alert.alert('Vitamin saved', 'The schedule was saved, but notifications could not be fully synchronized. Reminder App will repair them at the next startup.'), 150);
    } catch (error) {
      if (__DEV__) console.warn('Add vitamin failed', error);
      Alert.alert('Unable to add vitamin', 'Please check the schedule and try again.');
    }
  };
  return <Screen contentStyle={{ paddingBottom: 36 }}><AppHeader title="Add Vitamin/Supplement" back /><VitaminForm saving={saving} onSubmit={submit} /></Screen>;
}
