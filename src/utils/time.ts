export function parseTime(value: string): { hour: number; minute: number } {
  const [hour, minute] = value.split(':').map(Number);
  if (!Number.isInteger(hour) || !Number.isInteger(minute) || hour < 0 || hour > 23 || minute < 0 || minute > 59) throw new Error('Invalid reminder time');
  return { hour, minute };
}

export function formatTime(value: string): string {
  const { hour, minute } = parseTime(value);
  return new Date(2000, 0, 1, hour, minute).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

export function timeFromDate(value: Date): string {
  return `${String(value.getHours()).padStart(2, '0')}:${String(value.getMinutes()).padStart(2, '0')}`;
}

export function timeToDate(value: string): Date {
  const { hour, minute } = parseTime(value);
  const date = new Date();
  date.setHours(hour, minute, 0, 0);
  return date;
}

export function scheduledDateTime(date: string, time: string): Date {
  const [year, month, day] = date.split('-').map(Number);
  const { hour, minute } = parseTime(time);
  return new Date(year, month - 1, day, hour, minute);
}

export function formatTakenTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}
