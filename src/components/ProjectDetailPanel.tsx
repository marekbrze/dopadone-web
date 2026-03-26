import { useState, useEffect, useCallback } from 'react';
import type { Project, Task, Lifter } from '../types';
import { ConfirmModal } from './ConfirmModal';

interface Props {
  project: Project;
  tasks: Task[];
  lifters: Lifter[];
  parentCandidates: Project[];
  onUpdate: (updates: Partial<Project>) => void;
  onMoveToParent: (parentId: string | null) => void;
  onMoveToLifter: (lifterId: string | null) => void;
  onArchive: () => void;
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

export function ProjectDetailPanel({ project, tasks, lifters, parentCandidates, onUpdate, onMoveToParent, onMoveToLifter, onArchive, onDelete, onClose }: Props) {
  const [localName, setLocalName] = useState(project.name);
  const [pendingEndDate, setPendingEndDate] = useState<string | null | undefined>(undefined);

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
    setPendingEndDate(undefined);
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

  const handleEndDateChange = (val: string) => {
    const newDate = val || null;
    if (newDate) {
      const conflicting = tasks.filter(t => t.endDate && t.endDate > newDate);
      if (conflicting.length > 0) {
        setPendingEndDate(newDate);
        return;
      }
    }
    onUpdate({ endDate: newDate });
  };

  const confirmEndDateChange = () => {
    if (pendingEndDate !== undefined) {
      onUpdate({ endDate: pendingEndDate });
      setPendingEndDate(undefined);
    }
  };

  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 21 }, (_, i) => currentYear - 5 + i);

  const maxDay = startYear && startMonth
    ? daysInMonth(parseInt(startYear), parseInt(startMonth))
    : 31;
  const days = Array.from({ length: maxDay }, (_, i) => String(i + 1).padStart(2, '0'));

  return (
    <>
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

        {project.parentProjectId === null && (
          <div className="detail-field">
            <label>Podobszar</label>
            <select
              value={project.lifterId ?? ''}
              onChange={e => onMoveToLifter(e.target.value || null)}
            >
              <option value="">— brak —</option>
              {lifters.map(l => (
                <option key={l.id} value={l.id}>{l.name}</option>
              ))}
            </select>
          </div>
        )}

        <div className="detail-field">
          <label>Projekt nadrzędny</label>
          <select
            value={project.parentProjectId ?? ''}
            onChange={e => onMoveToParent(e.target.value || null)}
          >
            <option value="">— brak (projekt główny) —</option>
            {parentCandidates.map(p => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
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
            {startYear && (
              <button
                className="close-btn"
                onClick={() => {
                  setStartYear(''); setStartMonth(''); setStartDay('');
                  onUpdate({ startDate: null });
                }}
                title="Wyczyść datę rozpoczęcia"
              >✕</button>
            )}
          </div>
        </div>

        <div className="detail-field">
          <label>Data zakończenia</label>
          <div className="detail-date-row">
            <input
              type="date"
              className="detail-date-input"
              value={project.endDate ?? ''}
              onChange={e => handleEndDateChange(e.target.value)}
            />
            {project.endDate && (
              <button
                className="close-btn"
                onClick={() => onUpdate({ endDate: null })}
                title="Wyczyść datę zakończenia"
              >✕</button>
            )}
          </div>
        </div>

        <div className="project-danger-zone">
          <button className="archive-project-btn" onClick={onArchive}>Archiwizuj projekt</button>
          <button className="delete-task-btn" onClick={onDelete}>Usuń projekt</button>
        </div>
      </div>
    </div>

    {pendingEndDate !== undefined && (
      <ConfirmModal
        title="Zmiana daty zakończenia projektu"
        message={`Nowa data zakończenia projektu (${pendingEndDate}) jest wcześniejsza niż daty zakończenia niektórych zadań. Daty zakończenia tych zadań zostaną automatycznie zmienione na ${pendingEndDate}.`}
        onConfirm={confirmEndDateChange}
        onCancel={() => setPendingEndDate(undefined)}
      />
    )}
    </>
  );
}
