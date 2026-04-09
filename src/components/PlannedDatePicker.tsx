import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import './PlannedDatePicker.css';

interface Props {
  date: string | null | undefined;
  isNext?: boolean;
  onChange: (date: string | null, isNext?: boolean) => void;
  today: string; // "YYYY-MM-DD"
}

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

export function nextSaturday(today: string): string {
  const d = new Date(today + 'T00:00:00');
  const dow = d.getDay(); // 0=Sun, 6=Sat
  const daysUntil = (6 - dow + 7) % 7;
  return addDays(today, daysUntil);
}

export function nextMonday(today: string): string {
  const d = new Date(today + 'T00:00:00');
  const dow = d.getDay();
  const daysUntil = ((1 - dow + 7) % 7) || 7;
  return addDays(today, daysUntil);
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

export function PlannedDatePicker({ date, isNext, onChange, today }: Props) {
  const [open, setOpen] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customDate, setCustomDate] = useState('');
  const btnRef = useRef<HTMLButtonElement>(null);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 });

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (open) { setOpen(false); return; }
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      const dropLeft = Math.min(rect.left, window.innerWidth - 180);
      setDropPos({ top: rect.bottom + 4, left: dropLeft });
    }
    setShowCustomInput(false);
    setCustomDate('');
    setOpen(true);
  };

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (!(e.target as Element).closest('.pdp-dropdown')) setOpen(false);
    };
    const keyHandler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    document.addEventListener('keydown', keyHandler);
    return () => {
      document.removeEventListener('mousedown', handler);
      document.removeEventListener('keydown', keyHandler);
    };
  }, [open]);

  const pick = (newDate: string | null, newIsNext?: boolean) => {
    onChange(newDate, newIsNext);
    setOpen(false);
  };

  const options = [
    { label: 'Dziś', date: today },
    { label: 'Jutro', date: addDays(today, 1) },
    { label: 'Weekend', date: nextSaturday(today) },
    { label: 'Następny tydzień', date: nextMonday(today) },
    { label: 'Za tydzień', date: addDays(today, 7) },
    { label: 'Za miesiąc', date: addDays(today, 30) },
  ];

  const hasDate = date != null && date !== '';
  const isOverdue = hasDate && date! < today;

  return (
    <div className="pdp-root" onClick={e => e.stopPropagation()}>
      <button
        ref={btnRef}
        className={`pdp-chip${isNext ? ' is-next' : hasDate ? ' has-date' : ''}${isOverdue ? ' overdue' : ''}`}
        onClick={handleOpen}
        title={isNext ? 'Następne / Dowolnie' : hasDate ? `Zaplanowane: ${date}` : 'Ustaw datę planowania'}
      >
        {isNext
          ? <span className="pdp-next-label">następne</span>
          : hasDate
            ? formatPlannedDate(date!, today)
            : <span className="pdp-no-date">Brak daty</span>
        }
      </button>

      {open && createPortal(
        <div className="pdp-dropdown" style={{ top: dropPos.top, left: dropPos.left }}>
          {options.map(opt => (
            <button
              key={opt.date}
              className={`pdp-option${date === opt.date && !isNext ? ' active' : ''}`}
              onMouseDown={e => { e.preventDefault(); pick(opt.date, false); }}
            >
              <span className="pdp-option-label">{opt.label}</span>
              {opt.label !== 'Dziś' && opt.label !== 'Jutro' && opt.label !== 'Weekend' && opt.label !== 'Następny tydzień' && (
                <span className="pdp-option-hint">{formatPlannedDate(opt.date, today)}</span>
              )}
            </button>
          ))}
          {showCustomInput ? (
            <div className="pdp-custom-row">
              <input
                type="date"
                className="pdp-custom-input"
                value={customDate}
                autoFocus
                onChange={e => setCustomDate(e.target.value)}
                onClick={e => e.stopPropagation()}
                onKeyDown={e => {
                  e.stopPropagation();
                  if (e.key === 'Enter' && customDate) pick(customDate, false);
                  if (e.key === 'Escape') setShowCustomInput(false);
                }}
              />
              {customDate && (
                <button
                  className="pdp-custom-confirm"
                  onMouseDown={e => { e.preventDefault(); pick(customDate, false); }}
                >
                  OK
                </button>
              )}
            </div>
          ) : (
            <button
              className="pdp-option pdp-option-other"
              onMouseDown={e => { e.preventDefault(); setShowCustomInput(true); }}
            >
              Inna data…
            </button>
          )}
          <button
            className={`pdp-option pdp-option-next${isNext ? ' active' : ''}`}
            onMouseDown={e => { e.preventDefault(); pick(null, true); }}
          >
            Następne / Dowolnie
          </button>
          {(hasDate || isNext) && (
            <button
              className="pdp-option pdp-option-remove"
              onMouseDown={e => { e.preventDefault(); pick(null, false); }}
            >
              {isNext ? 'Usuń "następne"' : 'Usuń datę'}
            </button>
          )}
        </div>,
        document.body
      )}
    </div>
  );
}
