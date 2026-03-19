import { useState, useEffect } from 'react';
import type { Task, Context, Effort } from '../types';

const EFFORTS: { value: Effort; label: string }[] = [
  { value: 'xs', label: 'XS' },
  { value: 's', label: 'S' },
  { value: 'm', label: 'M' },
  { value: 'l', label: 'L' },
  { value: 'xl', label: 'XL' },
];

const priorityColors: Record<Task['priority'], string> = {
  low: '#8BC34A',
  medium: '#FF9800',
  high: '#F44336',
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
}

export function TaskDetailPanel({ task, contexts, onUpdate, onDelete, onClose }: Props) {
  const [localName, setLocalName] = useState(task.name);
  const [localNotes, setLocalNotes] = useState(task.notes);

  useEffect(() => {
    setLocalName(task.name);
    setLocalNotes(task.notes);
  }, [task.id]);

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
    <div className="task-detail-panel">
      <div className="detail-header">
        <span className="detail-title">Szczegóły zadania</span>
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

        <button className="delete-task-btn" onClick={onDelete}>Usuń zadanie</button>
      </div>
    </div>
  );
}
