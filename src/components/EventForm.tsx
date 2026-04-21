import { useState, useEffect, useRef } from 'react';
import React from 'react';
import type { CalendarEvent, Task, Project } from '../types';
import { EventProjectPicker } from './EventProjectPicker';

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function parseTime(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

export interface EventFormData {
  title: string;
  date: string;
  endDate: string | null;
  allDay: boolean;
  startMinutes: number | undefined;
  endMinutes: number | undefined;
  projectId: string | null;
  taskIds: string[];
  notes?: string;
  initialTasks?: string[];
}

interface CreateProps {
  mode: 'create';
  presentation: 'modal';
  defaultDate: string;
  defaultStartMinutes: number;
  defaultEndMinutes?: number;
  defaultAllDay?: boolean;
  projects: Project[];
  onSave: (data: EventFormData) => void;
  onClose?: () => void;
}

interface EditModalProps {
  mode: 'edit';
  presentation: 'modal';
  event: CalendarEvent;
  projects: Project[];
  onSave: (data: EventFormData) => void;
  onDelete?: () => void;
  onClose?: () => void;
}

interface EditInlineProps {
  mode: 'edit';
  presentation: 'inline';
  event: CalendarEvent;
  tasks: Task[];
  projects: Project[];
  onUpdate: (updates: Partial<CalendarEvent>) => void;
  onDelete: () => void;
  onAddTask: (name: string) => void;
  onUpdateTask: (id: string, updates: Partial<Task>) => void | Promise<void>;
}

type Props = CreateProps | EditModalProps | EditInlineProps;

export function EventForm(props: Props) {
  const isEdit = props.mode === 'edit';
  const isInline = props.presentation === 'inline';
  const event = isEdit ? props.event : null;

  const [title, setTitle] = useState(event?.title ?? '');
  const [date, setDate] = useState(event?.date ?? (props as CreateProps).defaultDate);
  const [endDate, setEndDate] = useState<string | null>(event?.endDate ?? null);
  const [allDay, setAllDay] = useState(event?.allDay ?? (props as CreateProps).defaultAllDay ?? false);
  const [startMin, setStartMin] = useState(
    event?.startMinutes ?? (props as CreateProps).defaultStartMinutes
  );
  const [endMin, setEndMin] = useState(
    event?.endMinutes ?? (props as CreateProps).defaultEndMinutes ?? ((props as CreateProps).defaultStartMinutes + 60)
  );
  const [projectId, setProjectId] = useState<string | null>(event?.projectId ?? null);

  const [notesDraft, setNotesDraft] = useState(event?.notes ?? '');
  const [initialTasks, setInitialTasks] = useState<string[]>([]);
  const [newTaskName, setNewTaskName] = useState('');
  const [activeTab, setActiveTab] = useState<'actions' | 'notes'>('actions');
  const [accordionOpen, setAccordionOpen] = useState(false);

  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const handleStartChange = (val: string) => {
    const s = parseTime(val);
    setStartMin(s);
    if (endMin <= s) setEndMin(s + 60);
  };

  const collectData = (): EventFormData => ({
    title: title.trim(),
    date,
    endDate,
    allDay,
    startMinutes: allDay ? undefined : startMin,
    endMinutes: allDay ? undefined : endMin,
    projectId,
    taskIds: event?.taskIds ?? [],
    notes: notesDraft || undefined,
    initialTasks: initialTasks.length > 0 ? initialTasks : undefined,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    if (props.mode === 'create' || props.presentation === 'modal') {
      (props as CreateProps | EditModalProps).onSave(collectData());
    }
  };

  const handleTitleBlur = () => {
    if (!isInline || !isEdit) return;
    const ep = props as EditInlineProps;
    if (title.trim() && title !== ep.event.title) {
      ep.onUpdate({ title: title.trim() });
    } else {
      setTitle(ep.event.title);
    }
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (isInline && e.key === 'Enter') (e.target as HTMLInputElement).blur();
    if (isInline && e.key === 'Escape') {
      if (isEdit) setTitle((props as EditInlineProps).event.title);
      (e.target as HTMLInputElement).blur();
    }
  };

  const handleAddInitialTask = () => {
    const name = newTaskName.trim();
    if (!name) return;
    setInitialTasks(prev => [...prev, name]);
    setNewTaskName('');
  };

  const handleRemoveInitialTask = (index: number) => {
    setInitialTasks(prev => prev.filter((_, i) => i !== index));
  };

  const renderProjectPicker = () => (
    <div className="form-group">
      <label>Projekt</label>
      <EventProjectPicker
        projects={props.projects}
        selectedProjectId={projectId}
        onChange={setProjectId}
      />
    </div>
  );

  const renderDateFields = () => {
    if (isInline && isEdit) {
      const ep = props as EditInlineProps;
      return (
        <div className="event-detail-section">
          <div className="event-detail-row">
            <label className="event-detail-label">Data</label>
            <input
              type="date"
              className="event-detail-date-input"
              value={date}
              onChange={e => ep.onUpdate({ date: e.target.value })}
            />
          </div>

          <div className="event-detail-row">
            <label className="event-detail-label">Cały dzień</label>
            <button
              className={`event-detail-toggle${allDay ? ' active' : ''}`}
              onClick={() => {
                if (allDay) {
                  ep.onUpdate({ allDay: false, startMinutes: 9 * 60, endMinutes: 10 * 60 });
                  setAllDay(false);
                  setStartMin(9 * 60);
                  setEndMin(10 * 60);
                } else {
                  ep.onUpdate({ allDay: true, startMinutes: undefined, endMinutes: undefined });
                  setAllDay(true);
                }
              }}
            >
              {allDay ? 'Tak' : 'Nie'}
            </button>
          </div>

          {!allDay && (
            <div className="event-detail-row">
              <label className="event-detail-label">Czas</label>
              <div className="event-detail-time-range">
                <input
                  type="time"
                  className="event-detail-time-input"
                  value={startMin !== undefined ? formatTime(startMin) : '09:00'}
                  onChange={e => {
                    const mins = parseTime(e.target.value);
                    const end = endMin ?? mins + 60;
                    const newEnd = Math.max(end, mins + 15);
                    ep.onUpdate({ startMinutes: mins, endMinutes: newEnd });
                    setStartMin(mins);
                    setEndMin(newEnd);
                  }}
                />
                <span className="event-detail-time-sep">–</span>
                <input
                  type="time"
                  className="event-detail-time-input"
                  value={endMin !== undefined ? formatTime(endMin) : '10:00'}
                  onChange={e => {
                    const mins = parseTime(e.target.value);
                    const newEnd = Math.max(mins, (startMin ?? 0) + 15);
                    ep.onUpdate({ endMinutes: newEnd });
                    setEndMin(newEnd);
                  }}
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
                value={endDate ?? ''}
                min={date}
                onChange={e => {
                  const val = e.target.value || null;
                  setEndDate(val);
                  ep.onUpdate({ endDate: val });
                }}
              />
              {endDate && (
                <button
                  className="event-detail-clear-btn"
                  onClick={() => {
                    setEndDate(null);
                    ep.onUpdate({ endDate: null });
                  }}
                  title="Usuń datę końcową"
                >×</button>
              )}
            </div>
          </div>
        </div>
      );
    }

    return (
      <>
        <div className="form-group">
          <label>Data</label>
          <input type="date" value={date} onChange={e => setDate(e.target.value)} />
        </div>

        <div className="form-group">
          <label className="event-modal-check-label">
            <input
              type="checkbox"
              checked={allDay}
              onChange={e => setAllDay(e.target.checked)}
            />
            Cały dzień
          </label>
        </div>

        {!allDay && (
          <div className="form-group agenda-time-row">
            <div>
              <label>Od</label>
              <input
                type="time"
                value={formatTime(startMin)}
                onChange={e => handleStartChange(e.target.value)}
              />
            </div>
            <div>
              <label>Do</label>
              <input
                type="time"
                value={formatTime(endMin)}
                onChange={e => setEndMin(parseTime(e.target.value))}
              />
            </div>
          </div>
        )}

        <div className="form-group">
          <label>Koniec (wielodniowe)</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <input
              type="date"
              value={endDate ?? ''}
              min={date}
              onChange={e => setEndDate(e.target.value || null)}
            />
            {endDate && (
              <button
                type="button"
                className="event-detail-clear-btn"
                onClick={() => setEndDate(null)}
                title="Usuń datę końcową"
              >×</button>
            )}
          </div>
        </div>
      </>
    );
  };

  const renderTasksSection = () => {
    if (isInline && isEdit) {
      const ep = props as EditInlineProps;
      const eventTasks = ep.event.taskIds
        .map(id => ep.tasks.find(t => t.id === id))
        .filter((t): t is Task => t !== undefined);

      return (
        <>
          {activeTab === 'actions' && (
            <div className="event-action-points">
              {eventTasks.map(task => (
                <div key={task.id} className={`event-task-item${task.done ? ' done' : ''}`}>
                  <input
                    type="checkbox"
                    checked={task.done}
                    onChange={() => ep.onUpdateTask(task.id, { done: !task.done })}
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
                    if (e.key === 'Enter') { handleAddInlineTask(); }
                  }}
                />
                <button
                  className="event-add-task-btn"
                  onClick={handleAddInlineTask}
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
                onBlur={() => {
                  if (notesDraft !== (ep.event.notes ?? '')) {
                    ep.onUpdate({ notes: notesDraft });
                  }
                }}
              />
            </div>
          )}
        </>
      );
    }

    return (
      <details
        className="form-group agenda-filters-details"
        open={accordionOpen}
        onToggle={e => setAccordionOpen((e.target as HTMLDetailsElement).open)}
      >
        <summary>Taski i notatki</summary>

        <div className="event-action-points">
          {initialTasks.map((name, i) => (
            <div key={i} className="event-task-item">
              <span className="event-task-name">{name}</span>
              <button
                type="button"
                className="event-detail-clear-btn"
                onClick={() => handleRemoveInitialTask(i)}
              >×</button>
            </div>
          ))}
          <div className="event-add-task-row">
            <input
              className="event-add-task-input"
              placeholder="Dodaj action point…"
              value={newTaskName}
              onChange={e => setNewTaskName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') { e.preventDefault(); handleAddInitialTask(); }
              }}
            />
            <button
              type="button"
              className="event-add-task-btn"
              onClick={handleAddInitialTask}
              disabled={!newTaskName.trim()}
            >+</button>
          </div>
        </div>

        <div className="agenda-panel-notes-wrap" style={{ marginTop: 8 }}>
          <textarea
            className="agenda-panel-notes-textarea"
            placeholder="Notatki do eventu…"
            value={notesDraft}
            onChange={e => setNotesDraft(e.target.value)}
          />
        </div>
      </details>
    );
  };

  const handleAddInlineTask = () => {
    const name = newTaskName.trim();
    if (!name) return;
    if (isInline && isEdit) {
      (props as EditInlineProps).onAddTask(name);
    }
    setNewTaskName('');
  };

  if (isInline) {
    return (
      <div className="event-detail-panel">
        <div className="event-detail-title-row">
          <span className="event-detail-icon">◈</span>
          <input
            className="event-detail-title-input"
            ref={titleRef}
            value={title}
            onChange={e => setTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={handleTitleKeyDown}
          />
        </div>

        {renderDateFields()}

        <div className="event-detail-section">
          <div className="event-detail-row">
            <label className="event-detail-label">Projekt</label>
            <EventProjectPicker
              projects={props.projects}
              selectedProjectId={projectId ?? null}
              onChange={id => {
                setProjectId(id);
                (props as EditInlineProps).onUpdate({ projectId: id });
              }}
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

        {renderTasksSection()}

        <div className="event-detail-footer">
          <button className="event-delete-btn" onClick={(props as EditInlineProps).onDelete}>
            Usuń wydarzenie
          </button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="modal-body">
      <div className="form-group">
        <label>Tytuł</label>
        <input
          ref={titleRef}
          type="text"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="np. Spotkanie z zespołem"
          required
        />
      </div>

      {renderProjectPicker()}
      {renderDateFields()}
      {renderTasksSection()}

      <div className="modal-footer">
        {isEdit && (props as EditModalProps).onDelete && (
          <button
            type="button"
            className="delete-task-btn"
            onClick={(props as EditModalProps).onDelete}
          >
            Usuń
          </button>
        )}
        <button type="submit" className="btn-primary">
          {isEdit ? 'Zapisz' : 'Dodaj'}
        </button>
      </div>
    </form>
  );
}

export function EventFormModal(props: Omit<CreateProps, 'presentation'> | (Omit<EditModalProps, 'presentation'>)) {
  const isEdit = props.mode === 'edit';
  const headerTitle = isEdit ? 'Edytuj wydarzenie' : 'Nowe wydarzenie';
  const onClose = props.onClose ?? (() => {});

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420, maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2>{headerTitle}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        {props.mode === 'create' ? (
          <EventForm {...props} presentation="modal" />
        ) : (
          <EventForm {...props} presentation="modal" />
        )}
      </div>
    </div>
  );
}
