import { useState, useEffect, useCallback } from 'react';
import type { Task, Context, Effort } from '../types';

const EFFORTS: { value: Effort; label: string }[] = [
  { value: 'xs', label: 'XS' },
  { value: 's', label: 'S' },
  { value: 'm', label: 'M' },
  { value: 'l', label: 'L' },
  { value: 'xl', label: 'XL' },
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
  onUpdate: (key: keyof Task, value: Task[keyof Task]) => void;
  onDelete: () => void;
  onClose: () => void;
  onCompleteWithNextAction: (nextActionName: string) => void;
}

export function TaskDetailPanel({ task, contexts, onUpdate, onDelete, onClose, onCompleteWithNextAction }: Props) {
  const [localName, setLocalName] = useState(task.name);
  const [localNotes, setLocalNotes] = useState(task.notes);
  const [nextAction, setNextAction] = useState('');

  useEffect(() => {
    setLocalName(task.name);
    setLocalNotes(task.notes ?? '');
    setNextAction('');
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
          <label>Nakład pracy</label>
          <div className="effort-pills">
            {EFFORTS.map(e => (
              <button
                key={e.value}
                className={`effort-pill ${task.effort === e.value ? 'active' : ''}`}
                onClick={() => onUpdate('effort', task.effort === e.value ? null : e.value)}
              >
                {e.label}
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

        <button className="delete-task-btn" onClick={onDelete}>Usuń zadanie</button>
      </div>
    </div>
  );
}
