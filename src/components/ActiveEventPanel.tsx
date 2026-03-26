import { useState } from 'react';
import type { CalendarEvent, Task, Project, ProjectNote } from '../types';
import { ProjectNotesPanel } from './ProjectNotesPanel';
import './ActiveEventPanel.css';

interface Props {
  event: CalendarEvent;
  tasks: Task[];
  projects: Project[];
  notes: ProjectNote[];
  now: Date;
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onAddTask: (name: string) => void;
  onAddNote: (data: { title?: string; content: string }) => Promise<void>;
  onUpdateNote: (id: string, updates: Partial<ProjectNote>) => Promise<void>;
  onDeleteNote: (id: string) => Promise<void>;
}

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function formatCountdown(seconds: number): string {
  if (seconds <= 0) return '0:00';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getCountdownColor(pct: number): string {
  if (pct > 0.5) return '#4a7c59';
  if (pct > 0.25) return '#9a7420';
  if (pct > 0.1) return '#b85a18';
  return '#b83232';
}

export function ActiveEventPanel({
  event, tasks, projects, notes, now,
  onUpdateTask, onAddTask, onAddNote, onUpdateNote, onDeleteNote,
}: Props) {
  const [newTaskName, setNewTaskName] = useState('');

  const nowSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const durationSeconds = ((event.endMinutes ?? 0) - (event.startMinutes ?? 0)) * 60;
  const remainingSeconds = Math.max(0, (event.endMinutes ?? 0) * 60 - nowSeconds);
  const remainingPct = remainingSeconds / (durationSeconds || 1);

  const eventTasks = event.taskIds
    .map(id => tasks.find(t => t.id === id))
    .filter((t): t is Task => t !== undefined);

  const selectedProject = event.projectId
    ? projects.find(p => p.id === event.projectId) ?? null
    : null;

  const handleAddTask = () => {
    const name = newTaskName.trim();
    if (!name) return;
    onAddTask(name);
    setNewTaskName('');
  };

  return (
    <div className="active-event-panel">
      <div
        className="today-active-header"
        style={{ borderTopColor: '#b8542a' }}
      >
        <div className="today-active-meta">
          <span className="today-active-time">
            {formatTime(event.startMinutes ?? 0)} – {formatTime(event.endMinutes ?? 0)}
          </span>
          <span className="today-active-live-dot" />
          <span
            className="today-block-countdown"
            style={{ color: getCountdownColor(remainingPct) }}
          >
            {formatCountdown(remainingSeconds)}
          </span>
        </div>
        <div className="today-active-title-row">
          <div className="today-active-title">{event.title}</div>
          {selectedProject && (
            <span className="active-event-project-badge">{selectedProject.name}</span>
          )}
        </div>
      </div>

      <div className="active-event-body">
        <div className="active-event-col-action-points">
          <div className="today-tasks-section-label">Action points</div>
          <div className="event-action-points">
            {eventTasks.map(task => (
              <div key={task.id} className={`event-task-item${task.done ? ' done' : ''}`}>
                <input
                  type="checkbox"
                  checked={task.done}
                  onChange={() => onUpdateTask(task.id, { done: !task.done })}
                  id={`active-event-task-${task.id}`}
                />
                <label htmlFor={`active-event-task-${task.id}`} className="event-task-name">
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
                onKeyDown={e => { if (e.key === 'Enter') handleAddTask(); }}
              />
              <button
                className="event-add-task-btn"
                onClick={handleAddTask}
                disabled={!newTaskName.trim()}
              >+</button>
            </div>
          </div>
        </div>

        <div className="active-event-col-notes">
          {event.projectId ? (
            <ProjectNotesPanel
              projectId={event.projectId}
              notes={notes}
              onCreate={onAddNote}
              onUpdate={onUpdateNote}
              onDelete={onDeleteNote}
            />
          ) : (
            <div className="active-event-no-project">
              Brak przypisanego projektu — notatki niedostępne
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
