import { useState, useRef, useEffect } from 'react';
import { createPortal } from 'react-dom';
import {
  localDateStr, addDays, formatPlannedDate,
  getDateOptions, parseDateInput, type DateOption,
} from './dateStepUtils';
import './PlannedDatePicker.css';

export { localDateStr, addDays, formatPlannedDate, nextSaturday, nextMonday } from './dateStepUtils';

interface Props {
  date: string | null | undefined;
  isNext?: boolean;
  onChange: (date: string | null, isNext?: boolean) => void;
  today: string;
}

export function PlannedDatePicker({ date, isNext, onChange, today }: Props) {
  const [open, setOpen] = useState(false);
  const [showCustomInput, setShowCustomInput] = useState(false);
  const [customText, setCustomText] = useState('');
  const btnRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dropPos, setDropPos] = useState({ top: 0, left: 0 });

  const dateOptions = getDateOptions(today);
  const parsedDate = parseDateInput(customText);

  const handleOpen = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (open) { setOpen(false); return; }
    const rect = btnRef.current?.getBoundingClientRect();
    if (rect) {
      const dropLeft = Math.min(rect.left, window.innerWidth - 180);
      setDropPos({ top: rect.bottom + 4, left: dropLeft });
    }
    setShowCustomInput(false);
    setCustomText('');
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

  useEffect(() => {
    if (showCustomInput && open) inputRef.current?.focus();
  }, [showCustomInput, open]);

  const pick = (newDate: string | null, newIsNext?: boolean) => {
    onChange(newDate, newIsNext);
    setOpen(false);
  };

  const confirmCustom = () => {
    if (parsedDate) pick(parsedDate, false);
  };

  const hasDate = date != null && date !== '';
  const isOverdue = hasDate && date! < today;

  const regularOptions = dateOptions.filter(o => !o.isCustom && !o.isNext);
  const customOption = dateOptions.find(o => o.isCustom)!;
  const nextOption = dateOptions.find(o => o.isNext)!;

  const NO_HINT_LABELS = new Set(['Dziś', 'Jutro', 'Weekend', 'Następny tydzień']);

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
          {regularOptions.map(opt => (
            <button
              key={opt.key}
              className={`pdp-option${date === opt.date && !isNext ? ' active' : ''}`}
              onClick={() => pick(opt.date, false)}
            >
              <span className="pdp-option-label">{opt.label}</span>
              {!NO_HINT_LABELS.has(opt.label) && (
                <span className="pdp-option-hint">{formatPlannedDate(opt.date!, today)}</span>
              )}
            </button>
          ))}
          {showCustomInput ? (
            <div className="pdp-custom-row">
              <input
                ref={inputRef}
                type="text"
                className="pdp-custom-input"
                placeholder="RRRR MM DD"
                value={customText}
                onChange={e => setCustomText(e.target.value)}
                onClick={e => e.stopPropagation()}
                onKeyDown={e => {
                  e.stopPropagation();
                  if (e.key === 'Enter' && parsedDate) confirmCustom();
                  if (e.key === 'Escape') { setShowCustomInput(false); setCustomText(''); }
                }}
              />
              {parsedDate && (
                <button
                  className="pdp-custom-confirm"
                  onClick={confirmCustom}
                >
                  {formatPlannedDate(parsedDate, today)}
                </button>
              )}
            </div>
          ) : (
            <button
              className="pdp-option pdp-option-other"
              onClick={() => setShowCustomInput(true)}
            >
              Inna data…
            </button>
          )}
          <button
            className={`pdp-option pdp-option-next${isNext ? ' active' : ''}`}
            onClick={() => pick(null, true)}
          >
            Następne / Dowolnie
          </button>
          {(hasDate || isNext) && (
            <button
              className="pdp-option pdp-option-remove"
              onClick={() => pick(null, false)}
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
