import { useState, useEffect } from 'react';
import type { CalendarEvent, Task, Project } from '../types';
import { EventProjectPicker } from './EventProjectPicker';

interface Props {
  event: CalendarEvent;
  tasks: Task[];
  projects: Project[];
  onUpdate: (updates: Partial<CalendarEvent>) => void;
  onDelete: () => void;
  onAddTask: (name: string) => void;
  onUpdateTask: (id: string, updates: Partial<Task>) => void | Promise<void>;
}

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function parseTime(str: string): number {
  const [h, m] = str.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export function EventDetailPanel({ event, tasks, projects, onUpdate, onDelete, onAddTask, onUpdateTask }: Props) {
  const [title, setTitle] = useState(event.title);
  const [newTaskName, setNewTaskName] = useState('');
  const [activeTab, setActiveTab] = useState<'actions' | 'notes'>('actions');
  const [notesDraft, setNotesDraft] = useState(event.notes ?? '');

  // Sync title and notes when event changes
  useEffect(() => {
    setTitle(event.title);
    setNotesDraft(event.notes ?? '');
    setActiveTab('actions');
  }, [event.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const eventTasks = event.taskIds
    .map(id => tasks.find(t => t.id === id))
    .filter((t): t is Task => t !== undefined);

  const handleTitleBlur = () => {
    if (title.trim() && title !== event.title) {
      onUpdate({ title: title.trim() });
    } else {
      setTitle(event.title);
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
    if (e.key === 'Escape') { setTitle(event.title); (e.target as HTMLInputElement).blur(); }
  };

  const handleAllDayToggle = () => {
    if (event.allDay) {
      onUpdate({ allDay: false, startMinutes: 9 * 60, endMinutes: 10 * 60 });
    } else {
      onUpdate({ allDay: true, startMinutes: undefined, endMinutes: undefined });
    }
  };

  const handleStartTimeChange = (val: string) => {
    const mins = parseTime(val);
    const end = event.endMinutes ?? mins + 60;
    onUpdate({ startMinutes: mins, endMinutes: Math.max(end, mins + 15) });
  };

  const handleEndTimeChange = (val: string) => {
    const mins = parseTime(val);
    onUpdate({ endMinutes: Math.max(mins, (event.startMinutes ?? 0) + 15) });
  };

  const handleAddTask = () => {
    const name = newTaskName.trim();
    if (!name) return;
    onAddTask(name);
    setNewTaskName('');
  };


  return (
    <div className="event-detail-panel">
      <div className="event-detail-title-row">
        <span className="event-detail-icon">◈</span>
        <input
          className="event-detail-title-input"
          value={title}
          onChange={e => setTitle(e.target.value)}
          onBlur={handleTitleBlur}
          onKeyDown={handleTitleKeyDown}
        />
      </div>

      <div className="event-detail-section">
        <div className="event-detail-row">
          <label className="event-detail-label">Data</label>
          <input
            type="date"
            className="event-detail-date-input"
            value={event.date}
            onChange={e => onUpdate({ date: e.target.value })}
          />
        </div>

        <div className="event-detail-row">
          <label className="event-detail-label">Cały dzień</label>
          <button
            className={`event-detail-toggle${event.allDay ? ' active' : ''}`}
            onClick={handleAllDayToggle}
          >
            {event.allDay ? 'Tak' : 'Nie'}
          </button>
        </div>

        {!event.allDay && (
          <div className="event-detail-row">
            <label className="event-detail-label">Czas</label>
            <div className="event-detail-time-range">
              <input
                type="time"
                className="event-detail-time-input"
                value={event.startMinutes !== undefined ? formatTime(event.startMinutes) : '09:00'}
                onChange={e => handleStartTimeChange(e.target.value)}
              />
              <span className="event-detail-time-sep">–</span>
              <input
                type="time"
                className="event-detail-time-input"
                value={event.endMinutes !== undefined ? formatTime(event.endMinutes) : '10:00'}
                onChange={e => handleEndTimeChange(e.target.value)}
              />
            </div>
          </div>
        )}

        <div className="event-detail-row">
          <label className="event-detail-label">Koniec (wielodniowe)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="date"
              className="event-detail-date-input"
              value={event.endDate ?? ''}
              min={event.date}
              onChange={e => onUpdate({ endDate: e.target.value || null })}
            />
            {event.endDate && (
              <button
                className="event-detail-clear-btn"
                onClick={() => onUpdate({ endDate: null })}
                title="Usuń datę końcową"
              >×</button>
            )}
          </div>
        </div>
      </div>

      <div className="event-detail-section">
        <div className="event-detail-row">
          <label className="event-detail-label">Projekt</label>
          <EventProjectPicker
            projects={projects}
            selectedProjectId={event.projectId ?? null}
            onChange={projectId => onUpdate({ projectId })}
          />
        </div>
      </div>

      <div className="agenda-panel-tabs event-panel-tabs">
        <button
          className={`agenda-panel-tab${activeTab === 'actions' ? ' active' : ''}`}
          onClick={() => setActiveTab('actions')}
        >Action Points</button>
        <button
          className={`agenda-panel-tab${activeTab === 'notes' ? ' active' : ''}`}
          onClick={() => setActiveTab('notes')}
        >Notatki</button>
      </div>

      {activeTab === 'actions' && (
        <div className="event-action-points">
          {eventTasks.map(task => (
            <div key={task.id} className={`event-task-item${task.done ? ' done' : ''}`}>
              <input
                type="checkbox"
                checked={task.done}
                onChange={() => onUpdateTask(task.id, { done: !task.done })}
                id={`event-task-${task.id}`}
              />
              <label htmlFor={`event-task-${task.id}`} className="event-task-name">
                {task.name}
              </label>
            </div>
          ))}
          <div className="event-add-task-row">
            <input
              className="event-add-task-input"
              placeholder="Dodaj action point…"
              value={newTaskName}
              onChange={e => setNewTaskName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleAddTask();
              }}
            />
            <button
              className="event-add-task-btn"
              onClick={handleAddTask}
              disabled={!newTaskName.trim()}
            >+</button>
          </div>
        </div>
      )}

      {activeTab === 'notes' && (
        <div className="agenda-panel-notes-wrap">
          <textarea
            className="agenda-panel-notes-textarea"
            placeholder="Notatki do eventu…"
            value={notesDraft}
            onChange={e => setNotesDraft(e.target.value)}
            onBlur={() => onUpdate({ notes: notesDraft })}
          />
        </div>
      )}

      <div className="event-detail-footer">
        <button className="event-delete-btn" onClick={onDelete}>
          Usuń wydarzenie
        </button>
      </div>
    </div>
  );
}
