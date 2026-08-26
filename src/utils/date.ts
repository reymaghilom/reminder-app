export function dateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function fromDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

export function formatFullDate(key: string): string {
  return fromDateKey(key).toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' });
}

export function formatShortDate(key: string): string {
  return fromDateKey(key).toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' });
}

export function greeting(now = new Date()): string {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning, Mama!';
  if (hour < 18) return 'Good afternoon, Mama!';
  return 'Good evening, Mama!';
}
