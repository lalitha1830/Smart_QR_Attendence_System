import { format, parseISO, isToday, isFuture } from 'date-fns';

export function formatDate(date: string | Date, fmt: string = 'MMM d, yyyy'): string {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return format(d, fmt);
}

export function formatTime(time: string): string {
  if (!time) return '';
  const [h, m] = time.split(':');
  const hour = parseInt(h, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const displayHour = hour % 12 || 12;
  return `${displayHour}:${m} ${ampm}`;
}

export function formatDateTime(date: string): string {
  return formatDate(date, "MMM d, yyyy 'at' h:mm a");
}

export function isDateToday(dateStr: string): boolean {
  return isToday(parseISO(dateStr));
}

export function isDateFuture(dateStr: string): boolean {
  return isFuture(parseISO(dateStr));
}

export function getDayOfWeek(date: string | Date): number {
  const d = typeof date === 'string' ? parseISO(date) : date;
  return d.getDay();
}

export function dayName(dayNum: number): string {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][dayNum] ?? '';
}

export function dayShort(dayNum: number): string {
  return ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][dayNum] ?? '';
}

export function initials(name: string): string {
  return name
    .split(' ')
    .map((n) => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export function truncate(str: string, len: number): string {
  return str.length > len ? str.slice(0, len) + '…' : str;
}

export function calculatePercentage(present: number, total: number): number {
  if (total === 0) return 0;
  return Math.round((present / total) * 100);
}

export function getAttendanceColor(pct: number): string {
  if (pct >= 75) return 'text-accent-600 dark:text-accent-400';
  if (pct >= 60) return 'text-amber-600 dark:text-amber-400';
  return 'text-red-600 dark:text-red-400';
}

export function getAttendanceBg(pct: number): string {
  if (pct >= 75) return 'bg-accent-500';
  if (pct >= 60) return 'bg-amber-500';
  return 'bg-red-500';
}

const AVATAR_COLORS = [
  'from-brand-500 to-brand-700',
  'from-accent-500 to-accent-700',
  'from-sky-500 to-sky-700',
  'from-violet-500 to-violet-700',
  'from-rose-500 to-rose-700',
  'from-amber-500 to-amber-700',
  'from-teal-500 to-teal-700',
  'from-indigo-500 to-indigo-700',
];

export function avatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}
