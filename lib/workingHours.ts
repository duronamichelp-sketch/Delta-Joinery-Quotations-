export type TimeEntry = {
  start: string;
  finish: string;
  breakMinutes?: string;
  notWorked?: boolean;
};

export type TimeRecords = Record<string, TimeEntry>;

export function localDateKey(date: Date): string {
  return date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0') + '-' + String(date.getDate()).padStart(2, '0');
}

export function weekStart(date: Date): Date {
  const monday = new Date(date);
  monday.setHours(12, 0, 0, 0);
  monday.setDate(monday.getDate() - (monday.getDay() + 6) % 7);
  return monday;
}

// Keep the timesheet's existing input conventions, including saved values such
// as "18:42 PM" and a bare finish time of "5" meaning 17:00.
export function parseTime(raw: string, kind: 'start' | 'finish'): number | null {
  if (typeof raw !== 'string') return null;
  const text = raw.trim().toUpperCase();
  if (!text) return null;
  const suffix = text.match(/(AM|PM)$/)?.[1];
  const value = text.replace(/\s*(AM|PM)$/, '').trim();
  const digits = value.replace(/:/g, '');
  if (!/^\d{1,4}$/.test(digits)) return null;
  const parts = value.includes(':') ? value.split(':') : digits.length <= 2 ? [digits, '0'] : [digits.slice(0, -2), digits.slice(-2)];
  if (parts.length !== 2) return null;
  let hour = Number(parts[0]);
  const minute = Number(parts[1]);
  if (hour > 23 || minute > 59) return null;
  if (suffix && hour <= 12) hour = hour % 12 + (suffix === 'PM' ? 12 : 0);
  else if (!suffix && kind === 'finish' && hour > 0 && hour < 12) hour += 12;
  return hour * 60 + minute;
}

export function formatTime(raw: string, kind: 'start' | 'finish'): string {
  const minutes = parseTime(raw, kind);
  if (minutes === null) return raw;
  const hour = Math.floor(minutes / 60);
  return hour + ':' + String(minutes % 60).padStart(2, '0') + (hour < 12 ? ' AM' : ' PM');
}

function liveStartTime(entry: TimeEntry | undefined, dateKey: string, now: Date): number | null {
  if (!entry || entry.notWorked || !Number.isFinite(now.getTime()) || dateKey !== localDateKey(now)) return null;
  // Older saved rows may omit finish. Treat missing values as empty, while
  // malformed nonempty values must not activate a timer.
  if (typeof entry.finish === 'string' ? entry.finish.trim() !== '' : entry.finish != null) return null;
  const start = parseTime(entry.start, 'start');
  if (start === null) return null;
  const timestamp = new Date(now);
  timestamp.setHours(Math.floor(start / 60), start % 60, 0, 0);
  return timestamp.getTime();
}

export function entryHours(entry: TimeEntry | undefined, dateKey: string, now: Date): number {
  if (!entry || entry.notWorked) return 0;
  const start = parseTime(entry.start, 'start');
  const finish = parseTime(entry.finish, 'finish');
  if (start === null) return 0;
  if (finish !== null) {
    // Completed overnight entries retain the original timesheet arithmetic.
    return Math.max(0, ((finish < start ? finish + 1440 : finish) - start) / 60);
  }
  // Only today's unfinished entry runs. Older incomplete rows still need a
  // finish time, and an invalid nonempty finish must not silently keep running.
  const startTime = liveStartTime(entry, dateKey, now);
  return startTime === null ? 0 : Math.max(0, (now.getTime() - startTime) / 3600000);
}

export function entryTimerState(entry: TimeEntry | undefined, dateKey: string, now: Date): 'running' | 'scheduled' | null {
  const startTime = liveStartTime(entry, dateKey, now);
  if (startTime === null) return null;
  return now.getTime() >= startTime ? 'running' : 'scheduled';
}

export function weekHours(records: TimeRecords, now: Date): number {
  const monday = weekStart(now);
  let total = 0;
  for (let day = 0; day < 7; day++) {
    const date = new Date(monday);
    date.setDate(date.getDate() + day);
    const dateKey = localDateKey(date);
    total += entryHours(records[dateKey], dateKey, now);
  }
  return total;
}

export function formatElapsed(hours: number): string {
  // The small tolerance avoids losing a second to decimal-hours rounding.
  const seconds = Number.isFinite(hours) ? Math.floor(Math.max(0, hours) * 3600 + 1e-7) : 0;
  return String(Math.floor(seconds / 3600)).padStart(2, '0') + ':' + String(Math.floor(seconds / 60) % 60).padStart(2, '0') + ':' + String(seconds % 60).padStart(2, '0');
}
