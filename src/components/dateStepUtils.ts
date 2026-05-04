export function localDateStr(d: Date = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(dateStr: string, days: number): string {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return localDateStr(d);
}

const MONTHS_SHORT = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];

export function formatPlannedDate(date: string, today: string): string {
  if (date === today) return 'dziś';
  if (date === addDays(today, 1)) return 'jutro';
  const d = new Date(date + 'T00:00:00');
  const todayYear = parseInt(today.slice(0, 4));
  const day = d.getDate();
  const month = MONTHS_SHORT[d.getMonth()];
  if (d.getFullYear() === todayYear) return `${day} ${month}`;
  return `${day} ${month} ${d.getFullYear()}`;
}

export function nextSaturday(today: string): string {
  const d = new Date(today + 'T00:00:00');
  const dow = d.getDay(); // 0=Sun, 6=Sat
  const daysUntil = (6 - dow + 7) % 7 || 7;
  return addDays(today, daysUntil);
}

export function nextMonday(today: string): string {
  const d = new Date(today + 'T00:00:00');
  const dow = d.getDay();
  const daysUntil = ((1 - dow + 7) % 7) || 7;
  return addDays(today, daysUntil);
}

export function firstOfNextMonth(today: string): string {
  const d = new Date(today + 'T00:00:00');
  return localDateStr(new Date(d.getFullYear(), d.getMonth() + 1, 1));
}

export type DateOption = { key: string; label: string; date: string | null; isNext?: boolean; isCustom?: boolean };

export function getDateOptions(today: string): DateOption[] {
  return [
    { key: '1', label: 'Dziś',              date: today },
    { key: '2', label: 'Jutro',             date: addDays(today, 1) },
    { key: '3', label: 'Weekend',           date: nextSaturday(today) },
    { key: '4', label: 'Następny tydzień',  date: nextMonday(today) },
    { key: '5', label: 'Za tydzień',        date: addDays(today, 7) },
    { key: '6', label: 'Następny miesiąc',  date: firstOfNextMonth(today) },
    { key: '7', label: 'Inna data',         date: null, isCustom: true },
    { key: 'n', label: 'Następne / Dowolnie', date: null, isNext: true },
  ];
}

export function parseDateInput(raw: string): string | null {
  const parts = raw.trim().split(/\s+/);
  if (parts.length === 0 || !parts[0]) return null;
  const year = parseInt(parts[0], 10);
  if (isNaN(year) || year < 2000 || year > 2099) return null;
  const month = parts.length >= 2 ? parseInt(parts[1], 10) : 1;
  if (isNaN(month) || month < 1 || month > 12) return null;
  const day = parts.length >= 3 ? parseInt(parts[2], 10) : 1;
  if (isNaN(day) || day < 1 || day > 31) return null;
  const d = new Date(year, month - 1, day);
  if (d.getFullYear() !== year || d.getMonth() !== month - 1 || d.getDate() !== day) return null;
  return localDateStr(d);
}
