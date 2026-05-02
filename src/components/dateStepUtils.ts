import { addDays, formatPlannedDate, localDateStr } from './PlannedDatePicker';

const QUARTER_LABELS = ['Q1', 'Q2', 'Q3', 'Q4'];
const QUARTER_MONTHS = [0, 3, 6, 9];

export type DateOption = { key: string; label: string; date: string | null; isNext?: boolean };

export function nextMonday(today: string): string {
  const d = new Date(today + 'T00:00:00');
  const day = d.getDay();
  const daysUntilMonday = day === 0 ? 1 : 8 - day;
  d.setDate(d.getDate() + daysUntilMonday);
  return localDateStr(d);
}

export function firstOfNextMonth(today: string): string {
  const d = new Date(today + 'T00:00:00');
  return localDateStr(new Date(d.getFullYear(), d.getMonth() + 1, 1));
}

export function getDateOptions(today: string): DateOption[] {
  const d = new Date(today + 'T00:00:00');
  const year = d.getFullYear();
  const currentQuarter = Math.floor(d.getMonth() / 3);

  const opts: DateOption[] = [
    { key: '1', label: 'Dziś',              date: today },
    { key: '2', label: 'Jutro',             date: addDays(today, 1) },
    { key: '3', label: 'Następny tydzień',  date: nextMonday(today) },
    { key: '4', label: 'Następny miesiąc',  date: firstOfNextMonth(today) },
  ];

  let keyIdx = 5;
  for (let q = currentQuarter + 1; q <= 3; q++) {
    opts.push({
      key: String(keyIdx++),
      label: `${QUARTER_LABELS[q]} ${year}`,
      date: localDateStr(new Date(year, QUARTER_MONTHS[q], 1)),
    });
  }

  opts.push({ key: String(keyIdx), label: `${year + 1}`, date: `${year + 1}-01-01` });
  opts.push({ key: 'n', label: 'Następne / Dowolnie', date: null, isNext: true });

  return opts;
}

export { addDays, formatPlannedDate, localDateStr };
