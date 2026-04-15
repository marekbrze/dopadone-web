import { useState, useEffect, useCallback } from 'react';
import type { Task, Context, Effort, Project, TaskDuration } from '../types';
import { SplitTaskModal } from './SplitTaskModal';
import { BatteryIcon } from './BatteryIcon';

function normalizeProjectStartDate(startDate: string | null | undefined): string | null {
  if (!startDate) return null;
  const parts = startDate.split('-');
  if (parts.length === 1) return `${parts[0]}-01-01`;
  if (parts.length === 2) return `${parts[0]}-${parts[1]}-01`;
  return startDate;
}

const DURATIONS: { value: TaskDuration; label: string }[] = [
  { value: 5,   label: '5m' },
  { value: 10,  label: '10m' },
  { value: 15,  label: '15m' },
  { value: 25,  label: '25m' },
  { value: 45,  label: '45m' },
  { value: 60,  label: '1h' },
  { value: 90,  label: '1,5h' },
  { value: 120, label: '2h' },
];

const ENERGY_LEVELS: { value: Effort; label: string; color: string; bars: number }[] = [
  { value: 'low',    label: 'Niski',   color: '#5a7a5e', bars: 1 },
  { value: 'medium', label: 'Średni',  color: '#a07830', bars: 2 },
  { value: 'high',   label: 'Wysoki',  color: '#a33a2a', bars: 3 },
];


const priorityColors: Record<Task['priority'], string> = {
  low: '#5a7a5e',
  medium: '#a07830',
  high: '#a33a2a',
};

const priorityLabels: Record<Task['priority'], string> = {
  low: 'Niska',
  medium: 'Średnia',
  high: 'Wysoka',
};

interface Props {
  task: Task;
  contexts: Context[];
  project?: Project | null;
  onUpdate: (key: keyof Task, value: Task[keyof Task]) => void;
  onDelete: () => void;
  onClose: () => void;
  onCompleteWithNextAction: (nextActionName: string) => void;
  onSplit?: (names: string[]) => Promise<void>;
}

export function TaskDetailPanel({ task, contexts, project, onUpdate, onDelete, onClose, onCompleteWithNextAction, onSplit }: Props) {
  const [localName, setLocalName] = useState(task.name);
  const [localNotes, setLocalNotes] = useState(task.notes);
  const [nextAction, setNextAction] = useState('');
  const [startDateError, setStartDateError] = useState('');
  const [endDateError, setEndDateError] = useState('');
  const [plannedDateError, setPlannedDateError] = useState('');
  const [showSplitModal, setShowSplitModal] = useState(false);

  const projectStartMin = normalizeProjectStartDate(project?.startDate);
  const projectEndMax = project?.endDate ?? null;

  useEffect(() => {
    setLocalName(task.name);
    setLocalNotes(task.notes ?? '');
    setNextAction('');
    setStartDateError('');
    setEndDateError('');
    setPlannedDateError('');
  }, [task.id]);

  const handleKeydown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [handleKeydown]);

  const commitName = () => {
    const trimmed = localName.trim();
    if (trimmed && trimmed !== task.name) {
      onUpdate('name', trimmed);
    } else {
      setLocalName(task.name);
    }
  };

  const commitNotes = () => {
    if (localNotes !== task.notes) {
      onUpdate('notes', localNotes);
    }
  };

  const handleStartDateChange = (val: string) => {
    const date = val || null;
    if (date && projectStartMin && date < projectStartMin) {
      setStartDateError(`Data nie może być wcześniejsza niż data rozpoczęcia projektu (${projectStartMin})`);
      return;
    }
    if (date && task.endDate && date > task.endDate) {
      setStartDateError('Data rozpoczęcia nie może być późniejsza niż data zakończenia zadania');
      return;
    }
    setStartDateError('');
    onUpdate('startDate', date);
    if (date && task.plannedDate && task.plannedDate < date) {
      setPlannedDateError('Data planowania jest teraz wcześniejsza niż data rozpoczęcia — zaktualizuj ją.');
    }
  };

  const handleEndDateChange = (val: string) => {
    const date = val || null;
    if (date && projectEndMax && date > projectEndMax) {
      setEndDateError(`Data nie może być późniejsza niż data zakończenia projektu (${projectEndMax})`);
      return;
    }
    if (date && task.startDate && date < task.startDate) {
      setEndDateError('Data zakończenia nie może być wcześniejsza niż data rozpoczęcia zadania');
      return;
    }
    setEndDateError('');
    onUpdate('endDate', date);
    if (date && task.plannedDate && task.plannedDate > date) {
      setPlannedDateError('Data planowania jest teraz późniejsza niż data zakończenia — zaktualizuj ją.');
    }
  };

  const handlePlannedDateChange = (val: string) => {
    const date = val || null;
    if (date && task.startDate && date < task.startDate) {
      setPlannedDateError('Data planowania nie może być wcześniejsza niż data rozpoczęcia zadania');
      return;
    }
    if (date && task.endDate && date > task.endDate) {
      setPlannedDateError('Data planowania nie może być późniejsza niż data zakończenia zadania');
      return;
    }
    setPlannedDateError('');
    onUpdate('plannedDate', date);
    if (date && task.isNext) onUpdate('isNext', false);
  };

  return (
    <div
      className="task-detail-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="task-detail-title"
    >
      <div className="detail-header">
        <span className="detail-title" id="task-detail-title">Szczegóły zadania</span>
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
            onKeyDown={e => { if (e.key === 'Enter') { commitName(); (e.target as HTMLInputElement).blur(); } if (e.key === 'Escape') setLocalName(task.name); }}
          />
        </div>

        <div className="detail-field">
          <label>Status</label>
          <label className="detail-checkbox-row">
            <input
              type="checkbox"
              checked={task.done}
              onChange={() => onUpdate('done', !task.done)}
            />
            <span>{task.done ? 'Ukończone' : 'Do zrobienia'}</span>
          </label>
        </div>

        <div className="detail-field">
          <label>Blokuje</label>
          <label className="detail-checkbox-row">
            <input
              type="checkbox"
              checked={task.blocking}
              onChange={() => onUpdate('blocking', !task.blocking)}
            />
            <span>Ktoś czeka na moje działanie</span>
          </label>
        </div>

        <div className="detail-field">
          <label>Priorytet</label>
          <select
            className="detail-select"
            value={task.priority}
            onChange={e => onUpdate('priority', e.target.value as Task['priority'])}
            style={{ color: priorityColors[task.priority] }}
          >
            {(['high', 'medium', 'low'] as Task['priority'][]).map(p => (
              <option key={p} value={p} style={{ color: priorityColors[p] }}>{priorityLabels[p]}</option>
            ))}
          </select>
        </div>

        <div className="detail-field">
          <label>Poziom energii</label>
          <div className="energy-pills">
            {ENERGY_LEVELS.map(e => {
              const isActive = task.effort === e.value;
              return (
                <button
                  key={e.value}
                  className={`energy-pill ${isActive ? 'active' : ''}`}
                  style={isActive ? { borderColor: e.color, background: e.color + '14', color: e.color } : undefined}
                  onClick={() => onUpdate('effort', isActive ? null : e.value)}
                >
                  <BatteryIcon bars={e.bars} color={isActive ? e.color : 'var(--text-muted)'} size={14} />
                  <span>{e.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="detail-field">
          <label>Czas trwania</label>
          <div className="effort-pills">
            {DURATIONS.map(d => (
              <button
                key={d.value}
                className={`effort-pill ${task.duration === d.value ? 'active' : ''}`}
                onClick={() => onUpdate('duration', task.duration === d.value ? null : d.value)}
              >
                {d.label}
              </button>
            ))}
          </div>
        </div>

        <div className="detail-field">
          <label>Kontekst</label>
          <select
            className="detail-select"
            value={task.contextId ?? ''}
            onChange={e => onUpdate('contextId', e.target.value || null)}
          >
            <option value="">— brak kontekstu —</option>
            {contexts.map(c => (
              <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
            ))}
          </select>
        </div>

        <div className="detail-field">
          <label>Notatki</label>
          <textarea
            className="detail-notes"
            value={localNotes}
            onChange={e => setLocalNotes(e.target.value)}
            onBlur={commitNotes}
            placeholder="Dodaj notatki..."
            rows={4}
          />
        </div>

        <div className="detail-field">
          <label>Data rozpoczęcia</label>
          <div className="detail-date-row">
            <input
              type="date"
              className="detail-date-input"
              value={task.startDate ?? ''}
              min={projectStartMin ?? undefined}
              max={task.endDate ?? undefined}
              onChange={e => handleStartDateChange(e.target.value)}
            />
            {task.startDate && (
              <button
                className="close-btn"
                onClick={() => { setStartDateError(''); setPlannedDateError(''); onUpdate('startDate', null); }}
                title="Wyczyść datę rozpoczęcia"
              >✕</button>
            )}
          </div>
          {startDateError && <span className="detail-date-error">{startDateError}</span>}
        </div>

        <div className="detail-field">
          <label>Data zakończenia</label>
          <div className="detail-date-row">
            <input
              type="date"
              className="detail-date-input"
              value={task.endDate ?? ''}
              min={task.startDate ?? undefined}
              max={projectEndMax ?? undefined}
              onChange={e => handleEndDateChange(e.target.value)}
            />
            {task.endDate && (
              <button
                className="close-btn"
                onClick={() => { setEndDateError(''); setPlannedDateError(''); onUpdate('endDate', null); }}
                title="Wyczyść datę zakończenia"
              >✕</button>
            )}
          </div>
          {endDateError && <span className="detail-date-error">{endDateError}</span>}
        </div>

        <div className="detail-field">
          <label>Data planowania</label>
          {task.isNext && !task.plannedDate && (
            <div className="detail-next-badge">
              <span className="detail-next-label">następne / dowolnie</span>
              <button
                className="close-btn"
                onClick={() => onUpdate('isNext', false)}
                title="Usuń 'następne'"
              >✕</button>
            </div>
          )}
          <div className="detail-date-row">
            <input
              type="date"
              className="detail-date-input"
              value={task.plannedDate ?? ''}
              min={task.startDate ?? undefined}
              max={task.endDate ?? undefined}
              onChange={e => handlePlannedDateChange(e.target.value)}
            />
            {task.plannedDate && (
              <button
                className="close-btn"
                onClick={() => { setPlannedDateError(''); onUpdate('plannedDate', null); }}
                title="Wyczyść datę planowania"
              >✕</button>
            )}
          </div>
          {!task.isNext && !task.plannedDate && (
            <button
              className="detail-next-set-btn"
              onClick={() => onUpdate('isNext', true)}
            >
              Ustaw jako następne
            </button>
          )}
          {plannedDateError && <span className="detail-date-error">{plannedDateError}</span>}
        </div>

        <div className="detail-field">
          <label>Następna akcja</label>
          <input
            className="detail-name-input"
            value={nextAction}
            onChange={e => setNextAction(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && nextAction.trim()) onCompleteWithNextAction(nextAction.trim()); }}
            placeholder="Wpisz następne zadanie..."
          />
          <button
            className="next-action-btn"
            onClick={() => onCompleteWithNextAction(nextAction.trim())}
            disabled={!nextAction.trim()}
          >
            Zakończ i utwórz
          </button>
        </div>

        <div className="task-danger-row">
          {onSplit && (
            <button className="split-task-btn" onClick={() => setShowSplitModal(true)}>
              Rozbij
            </button>
          )}
          <button className="delete-task-btn" onClick={onDelete}>Usuń zadanie</button>
        </div>
      </div>
      {showSplitModal && (
        <SplitTaskModal
          taskName={task.name}
          onConfirm={async (names) => {
            setShowSplitModal(false);
            await onSplit!(names);
          }}
          onClose={() => setShowSplitModal(false)}
        />
      )}
    </div>
  );
}
