import { useMemo, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { Ionicons } from '@expo/vector-icons';
import { AppSwitch } from './AppSwitch';
import { OptionSheet } from './OptionSheet';
import { MEAL_PERIODS } from '@/constants/defaults';
import { radius, shadows, spacing } from '@/constants/theme';
import { useTheme } from '@/hooks/useTheme';
import { DoseScheduleInput, MealPeriod, Reminder, Vitamin, VitaminInput } from '@/types';
import { formatTime, timeFromDate, timeToDate } from '@/utils/time';
import { scheduleLabel } from '@/utils/scheduleLabel';

const MAX_DAILY_DOSES = 6;
type FrequencyMode = '1' | '2' | '3' | '4' | 'custom' | null;
type FormDose = Omit<DoseScheduleInput, 'mealPeriod' | 'scheduledTime'> & { mealPeriod: MealPeriod | null; scheduledTime: string };

function blankDose(index: number): FormDose {
  return { doseNumber: index + 1, mealPeriod: null, customScheduleLabel: '', scheduledTime: '', enabled: true, sortOrder: index + 1 };
}

function frequencyLabel(mode: Exclude<FrequencyMode, null>): string {
  if (mode === 'custom') return 'Custom';
  return mode === '1' ? 'Once daily' : mode === '2' ? 'Twice daily' : `${mode} times daily`;
}

export function VitaminForm({
  vitamin,
  reminders = [],
  saving,
  onSubmit,
  onRemove,
}: {
  vitamin?: Vitamin;
  reminders?: Reminder[];
  saving: boolean;
  onSubmit: (input: VitaminInput) => Promise<void>;
  onRemove?: () => void;
}) {
  const { theme } = useTheme();
  const initialDoses = useMemo<FormDose[]>(() => reminders.map((item, index) => ({
    id: item.id,
    doseNumber: index + 1,
    mealPeriod: item.mealPeriod,
    customScheduleLabel: item.customScheduleLabel,
    scheduledTime: item.scheduledTime,
    enabled: item.enabled,
    sortOrder: index + 1,
  })), [reminders]);
  const initialCount = initialDoses.length;
  const [name, setName] = useState(vitamin?.name ?? '');
  const [brand, setBrand] = useState(vitamin?.brand ?? '');
  const [description, setDescription] = useState(vitamin?.description ?? '');
  const [doses, setDoses] = useState<FormDose[]>(initialDoses);
  const [frequency, setFrequencyMode] = useState<FrequencyMode>(initialCount ? (initialCount <= 4 ? String(initialCount) as FrequencyMode : 'custom') : null);
  const [periodDoseIndex, setPeriodDoseIndex] = useState<number | null>(null);
  const [timeDoseIndex, setTimeDoseIndex] = useState<number | null>(null);

  const applyCount = (count: number) => {
    setDoses((current) => {
      const alreadyMatches = current.length === count
        && current.every((dose, index) => dose.doseNumber === index + 1 && dose.sortOrder === index + 1);
      if (alreadyMatches) return current;
      return Array.from({ length: count }, (_, index) => {
        const existing = current[index];
        return existing ? { ...existing, doseNumber: index + 1, sortOrder: index + 1 } : blankDose(index);
      });
    });
  };

  const requestCount = (count: number, onAccepted?: () => void) => {
    if (vitamin && count < initialCount && count < doses.length) {
      Alert.alert(
        'Reduce daily frequency?',
        `Changing to ${count === 1 ? 'once daily' : `${count} times daily`} will stop future reminders for ${initialCount - count === 1 ? 'the extra dose' : `${initialCount - count} extra doses`}. Previous history will be kept.`,
        [{ text: 'Cancel', style: 'cancel' }, { text: 'Continue', onPress: () => { applyCount(count); onAccepted?.(); } }],
      );
      return;
    }
    applyCount(count);
    onAccepted?.();
  };

  const selectFrequency = (mode: Exclude<FrequencyMode, null>) => {
    if (mode === 'custom') {
      const count = doses.length || 1;
      requestCount(count, () => setFrequencyMode('custom'));
      return;
    }
    const count = Number(mode);
    requestCount(count, () => setFrequencyMode(mode));
  };

  const updateDose = (index: number, values: Partial<FormDose>) => {
    setDoses((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...values } : item));
  };

  const onTime = (event: DateTimePickerEvent, selected?: Date) => {
    if (timeDoseIndex === null) return;
    if (Platform.OS === 'android' || event.type === 'dismissed') setTimeDoseIndex(null);
    if (selected) updateDose(timeDoseIndex, { scheduledTime: timeFromDate(selected) });
  };

  const validateAndSubmit = async () => {
    if (saving) return;
    if (!name.trim()) return Alert.alert('Name required', 'Enter a vitamin or supplement name.');
    if (!frequency || !doses.length) return Alert.alert('Frequency required', 'Choose how many times per day this reminder should occur.');
    const invalidTime = doses.findIndex((dose) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(dose.scheduledTime));
    if (invalidTime >= 0) return Alert.alert('Reminder time required', `Choose a valid reminder time for Dose ${invalidTime + 1}.`);
    const invalidPeriod = doses.findIndex((dose) => !dose.mealPeriod);
    if (invalidPeriod >= 0) return Alert.alert('Schedule type required', `Choose a schedule for Dose ${invalidPeriod + 1}.`);
    const invalidCustom = doses.findIndex((dose) => dose.mealPeriod === 'Custom' && !dose.customScheduleLabel.trim());
    if (invalidCustom >= 0) return Alert.alert('Custom schedule required', `Enter a custom schedule for Dose ${invalidCustom + 1}.`);
    await onSubmit({
      name: name.trim(),
      brand: brand.trim(),
      description: description.trim(),
      doses: doses.map((dose, index) => ({
        ...dose,
        mealPeriod: dose.mealPeriod as MealPeriod,
        doseNumber: index + 1,
        sortOrder: index + 1,
        customScheduleLabel: dose.mealPeriod === 'Custom' ? dose.customScheduleLabel.trim() : '',
      })),
    });
  };

  return <>
    <View style={[styles.notice, { backgroundColor: theme.primarySoft }]}><Ionicons name="information-circle-outline" size={20} color={theme.primaryStrong} /><Text style={[styles.noticeText, { color: theme.textSecondary }]}>Set the schedule according to the instructions from your healthcare professional.</Text></View>
    <View style={[styles.card, shadows.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}>
      <FieldLabel text="Vitamin / Supplement Name" required color={theme.textSecondary} />
      <TextInput value={name} onChangeText={setName} editable={!saving} maxLength={80} placeholder="Enter name" placeholderTextColor={theme.muted} style={[styles.input, { color: theme.text, backgroundColor: theme.input, borderColor: theme.border }]} />
      <FieldLabel text="Brand" color={theme.textSecondary} />
      <TextInput value={brand} onChangeText={setBrand} editable={!saving} maxLength={80} placeholder="Optional" placeholderTextColor={theme.muted} style={[styles.input, { color: theme.text, backgroundColor: theme.input, borderColor: theme.border }]} />
      <FieldLabel text="Description / Nutrient Information" color={theme.textSecondary} />
      <TextInput value={description} onChangeText={setDescription} editable={!saving} maxLength={240} multiline placeholder="Optional" placeholderTextColor={theme.muted} style={[styles.input, styles.descriptionInput, { color: theme.text, backgroundColor: theme.input, borderColor: theme.border }]} />
    </View>

    <Text style={[styles.sectionTitle, { color: theme.text }]}>Daily Frequency</Text>
    <Text style={[styles.sectionSub, { color: theme.textSecondary }]}>You decide how many reminders to schedule each day.</Text>
    <View style={styles.frequencyGrid}>{(['1', '2', '3', '4', 'custom'] as const).map((mode) => {
      const selected = frequency === mode;
      return <Pressable key={mode} disabled={saving} onPress={() => selectFrequency(mode)} style={[styles.frequency, { backgroundColor: selected ? theme.primary : theme.surfaceElevated, borderColor: selected ? theme.primary : theme.border }]}><Text style={[styles.frequencyText, { color: selected ? theme.white : theme.text }]}>{frequencyLabel(mode)}</Text></Pressable>;
    })}</View>
    {frequency === 'custom' && <View style={[styles.customControls, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}><Text style={[styles.customCount, { color: theme.text }]}>{doses.length} {doses.length === 1 ? 'dose' : 'doses'} daily</Text><View style={styles.customButtons}><Pressable disabled={saving || doses.length <= 1} onPress={() => requestCount(doses.length - 1)} style={[styles.smallButton, { borderColor: theme.border, opacity: doses.length <= 1 ? 0.45 : 1 }]}><Ionicons name="remove" size={20} color={theme.text} /><Text style={[styles.smallButtonText, { color: theme.text }]}>Remove Dose</Text></Pressable><Pressable disabled={saving || doses.length >= MAX_DAILY_DOSES} onPress={() => requestCount(doses.length + 1)} style={[styles.smallButton, { borderColor: theme.border, opacity: doses.length >= MAX_DAILY_DOSES ? 0.45 : 1 }]}><Ionicons name="add" size={20} color={theme.text} /><Text style={[styles.smallButtonText, { color: theme.text }]}>Add Dose</Text></Pressable></View><Text style={[styles.maxText, { color: theme.muted }]}>Maximum {MAX_DAILY_DOSES} doses per day</Text></View>}

    {doses.map((dose, index) => <View key={dose.id ?? `new-${index}`} style={[styles.doseCard, shadows.card, { backgroundColor: theme.surfaceElevated, borderColor: theme.border, opacity: dose.enabled ? 1 : 0.72 }]}>
      <View style={styles.doseHeader}><View style={[styles.doseNumber, { backgroundColor: theme.primarySoft }]}><Text style={[styles.doseNumberText, { color: theme.primaryStrong }]}>{index + 1}</Text></View><View style={styles.doseCopy}><Text style={[styles.doseTitle, { color: theme.text }]}>Dose {index + 1}</Text><Text style={[styles.doseSummary, { color: theme.textSecondary }]}>{dose.scheduledTime && dose.mealPeriod ? `${scheduleLabel(dose.mealPeriod, dose.customScheduleLabel)} · ${formatTime(dose.scheduledTime)}` : 'Schedule not complete'}</Text></View><AppSwitch accessibilityLabel={`Dose ${index + 1} enabled`} value={dose.enabled} disabled={saving} onValueChange={(enabled) => updateDose(index, { enabled })} /></View>
      <FieldLabel text="Schedule Type" required color={theme.textSecondary} />
      <Pressable disabled={saving} onPress={() => setPeriodDoseIndex(index)} style={[styles.selector, { backgroundColor: theme.input, borderColor: theme.border }]}><Ionicons name="restaurant-outline" size={18} color={theme.primaryStrong} /><Text style={[styles.selectorText, { color: dose.mealPeriod ? theme.text : theme.muted }]}>{dose.mealPeriod ?? 'Choose Schedule'}</Text><Ionicons name="chevron-down" size={18} color={theme.muted} /></Pressable>
      {dose.mealPeriod === 'Custom' && <TextInput value={dose.customScheduleLabel} onChangeText={(value) => updateDose(index, { customScheduleLabel: value })} editable={!saving} maxLength={60} placeholder="Custom schedule" placeholderTextColor={theme.muted} style={[styles.input, styles.customLabel, { color: theme.text, backgroundColor: theme.input, borderColor: theme.border }]} />}
      <FieldLabel text="Reminder Time" required color={theme.textSecondary} />
      <Pressable disabled={saving} onPress={() => setTimeDoseIndex(index)} style={[styles.selector, { backgroundColor: theme.input, borderColor: theme.border }]}><Ionicons name="time-outline" size={18} color={theme.primaryStrong} /><Text style={[styles.selectorText, { color: dose.scheduledTime ? theme.text : theme.muted }]}>{dose.scheduledTime ? formatTime(dose.scheduledTime) : 'Choose time'}</Text><Ionicons name="chevron-forward" size={18} color={theme.muted} /></Pressable>
    </View>)}

    <Pressable disabled={saving} onPress={() => void validateAndSubmit()} style={({ pressed }) => [styles.save, { backgroundColor: theme.primary, opacity: saving ? 0.58 : pressed ? 0.82 : 1 }]}><Ionicons name="checkmark-circle-outline" size={20} color={theme.white} /><Text style={styles.saveText}>{saving ? 'Saving…' : vitamin ? 'Save Vitamin' : 'Add Vitamin/Supplement'}</Text></Pressable>
    {onRemove && <Pressable disabled={saving} onPress={onRemove} style={({ pressed }) => [styles.remove, { borderColor: theme.danger, opacity: saving ? 0.5 : pressed ? 0.7 : 1 }]}><Ionicons name="archive-outline" size={19} color={theme.danger} /><Text style={[styles.removeText, { color: theme.danger }]}>Remove Vitamin</Text></Pressable>}

    <OptionSheet visible={periodDoseIndex !== null} title="Schedule Type" options={MEAL_PERIODS} value={periodDoseIndex === null ? 'After Breakfast' : doses[periodDoseIndex]?.mealPeriod ?? 'After Breakfast'} onSelect={(value: MealPeriod) => { if (periodDoseIndex !== null) updateDose(periodDoseIndex, { mealPeriod: value }); }} onClose={() => setPeriodDoseIndex(null)} />
    {timeDoseIndex !== null && <View style={[styles.pickerCard, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}><DateTimePicker value={doses[timeDoseIndex]?.scheduledTime ? timeToDate(doses[timeDoseIndex].scheduledTime) : new Date()} mode="time" display={Platform.OS === 'ios' ? 'spinner' : 'default'} onChange={onTime} />{Platform.OS === 'ios' && <Pressable onPress={() => setTimeDoseIndex(null)} style={[styles.pickerDone, { backgroundColor: theme.primary }]}><Text style={styles.pickerDoneText}>Done</Text></Pressable>}</View>}
  </>;
}

function FieldLabel({ text, required = false, color }: { text: string; required?: boolean; color: string }) {
  return <Text style={[styles.label, { color }]}>{text}{required ? ' *' : ''}</Text>;
}

const styles = StyleSheet.create({
  notice: { borderRadius: radius.lg, padding: 14, flexDirection: 'row', gap: 9, marginBottom: 14 },
  noticeText: { flex: 1, fontSize: 12, lineHeight: 18 },
  card: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.lg },
  label: { fontSize: 10, fontWeight: '800', letterSpacing: 0.65, textTransform: 'uppercase', marginTop: 15, marginBottom: 7 },
  input: { minHeight: 52, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 14, fontSize: 14 },
  descriptionInput: { minHeight: 82, paddingTop: 13, textAlignVertical: 'top' },
  sectionTitle: { fontSize: 18, fontWeight: '800', marginTop: 25 },
  sectionSub: { fontSize: 12, marginTop: 5, marginBottom: 12 },
  frequencyGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  frequency: { minHeight: 42, borderWidth: 1, borderRadius: 999, paddingHorizontal: 14, alignItems: 'center', justifyContent: 'center' },
  frequencyText: { fontSize: 12, fontWeight: '800' },
  customControls: { borderWidth: 1, borderRadius: radius.lg, marginTop: 12, padding: 14 },
  customCount: { fontSize: 14, fontWeight: '800' },
  customButtons: { flexDirection: 'row', gap: 8, marginTop: 11 },
  smallButton: { flex: 1, minHeight: 40, borderWidth: 1, borderRadius: radius.sm, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  smallButtonText: { fontSize: 11, fontWeight: '700' },
  maxText: { fontSize: 10, marginTop: 9 },
  doseCard: { borderWidth: 1, borderRadius: radius.xl, padding: spacing.lg, marginTop: 14 },
  doseHeader: { flexDirection: 'row', alignItems: 'center', marginBottom: 2 },
  doseNumber: { width: 38, height: 38, borderRadius: 13, alignItems: 'center', justifyContent: 'center' },
  doseNumberText: { fontSize: 15, fontWeight: '900' },
  doseCopy: { flex: 1, marginHorizontal: 11 },
  doseTitle: { fontSize: 15, fontWeight: '800' },
  doseSummary: { fontSize: 10, marginTop: 3 },
  selector: { minHeight: 52, borderWidth: 1, borderRadius: radius.md, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9 },
  selectorText: { flex: 1, fontSize: 14, fontWeight: '700' },
  customLabel: { marginTop: 9 },
  save: { height: 54, borderRadius: radius.lg, marginTop: 22, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8 },
  saveText: { color: '#FFFFFF', fontSize: 15, fontWeight: '800' },
  remove: { height: 50, borderWidth: 1, borderRadius: radius.lg, marginTop: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7 },
  removeText: { fontSize: 13, fontWeight: '800' },
  pickerCard: { borderWidth: 1, borderRadius: radius.xl, padding: 12, marginTop: 12 },
  pickerDone: { height: 42, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  pickerDoneText: { color: '#FFFFFF', fontWeight: '800' },
});
