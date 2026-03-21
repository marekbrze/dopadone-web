import { useState, useEffect, useCallback } from 'react';
import { Project } from '../types';

interface Props {
  project: Project;
  onUpdate: (updates: Partial<Project>) => void;
  onDelete: () => void;
  onClose: () => void;
}

const MONTHS = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień',
];

function daysInMonth(year: number, month: number): number {
  return new Date(year, month, 0).getDate();
}

function parseStartDate(value: string | null | undefined): { year: string; month: string; day: string } {
  if (!value) return { year: '', month: '', day: '' };
  const parts = value.split('-');
  return {
    year: parts[0] ?? '',
    month: parts[1] ?? '',
    day: parts[2] ?? '',
  };
}

function buildStartDate(year: string, month: string, day: string): string | null {
  if (!year) return null;
  if (!month) return year;
  if (!day) return `${year}-${month}`;
  return `${year}-${month}-${day}`;
}

export function ProjectDetailPanel({ project, onUpdate, onDelete, onClose }: Props) {
  const [localName, setLocalName] = useState(project.name);

  const parsed = parseStartDate(project.startDate);
  const [startYear, setStartYear] = useState(parsed.year);
  const [startMonth, setStartMonth] = useState(parsed.month);
  const [startDay, setStartDay] = useState(parsed.day);

  useEffect(() => {
    setLocalName(project.name);
    const p = parseStartDate(project.startDate);
    setStartYear(p.year);
    setStartMonth(p.month);
    setStartDay(p.day);
  }, [project.id]);

  const handleKeydown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [handleKeydown]);

  const commitName = () => {
    const trimmed = localName.trim();
    if (trimmed && trimmed !== project.name) {
      onUpdate({ name: trimmed });
    } else {
      setLocalName(project.name);
    }
  };

  const handleYearChange = (year: string) => {
    setStartYear(year);
    const month = year ? startMonth : '';
    const day = year ? startDay : '';
    if (!year) { setStartMonth(''); setStartDay(''); }
    onUpdate({ startDate: buildStartDate(year, month, day) });
  };

  const handleMonthChange = (month: string) => {
    setStartMonth(month);
    const day = month ? startDay : '';
    if (!month) setStartDay('');
    onUpdate({ startDate: buildStartDate(startYear, month, day) });
  };

  const handleDayChange = (day: string) => {
    setStartDay(day);
    onUpdate({ startDate: buildStartDate(startYear, startMonth, day) });
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 21 }, (_, i) => currentYear - 5 + i);

  const maxDay = startYear && startMonth
    ? daysInMonth(parseInt(startYear), parseInt(startMonth))
    : 31;
  const days = Array.from({ length: maxDay }, (_, i) => String(i + 1).padStart(2, '0'));

  return (
    <div
      className="task-detail-panel item-detail-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="project-detail-title"
    >
      <div className="detail-header">
        <span className="detail-title" id="project-detail-title">Projekt</span>
        <button className="close-btn" onClick={onClose}>✕</button>
      </div>
      <div className="task-detail-body">
        <div className="detail-field">
          <label>Nazwa</label>
          <input
            className="detail-name-input"
            value={localName}
            onChange={e => setLocalName(e.target.value)}
            onBlur={commitName}
            onKeyDown={e => {
              if (e.key === 'Enter') { commitName(); (e.target as HTMLInputElement).blur(); }
              if (e.key === 'Escape') setLocalName(project.name);
            }}
            autoFocus
          />
        </div>

        <div className="detail-field">
          <label>Data rozpoczęcia</label>
          <div className="detail-date-row">
            <select
              value={startYear}
              onChange={e => handleYearChange(e.target.value)}
            >
              <option value="">— rok —</option>
              {years.map(y => (
                <option key={y} value={String(y)}>{y}</option>
              ))}
            </select>
            <select
              value={startMonth}
              onChange={e => handleMonthChange(e.target.value)}
              disabled={!startYear}
            >
              <option value="">— miesiąc —</option>
              {MONTHS.map((m, i) => (
                <option key={i} value={String(i + 1).padStart(2, '0')}>{m}</option>
              ))}
            </select>
            <select
              value={startDay}
              onChange={e => handleDayChange(e.target.value)}
              disabled={!startMonth}
            >
              <option value="">— dzień —</option>
              {days.map(d => (
                <option key={d} value={d}>{parseInt(d)}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="detail-field">
          <label>Data zakończenia</label>
          <input
            type="date"
            className="detail-date-input"
            value={project.endDate ?? ''}
            onChange={e => onUpdate({ endDate: e.target.value || null })}
          />
        </div>

        <button className="delete-task-btn" onClick={onDelete}>Usuń projekt</button>
      </div>
    </div>
  );
}
