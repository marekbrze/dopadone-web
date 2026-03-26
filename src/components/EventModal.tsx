import { useState, useRef, useEffect } from 'react';
import React from 'react';
import type { CalendarEvent, Project } from '../types';

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function parseTime(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

interface Props {
  event: Partial<CalendarEvent> | null; // null = create new
  defaultDate: string;
  defaultStartMinutes: number;
  defaultEndMinutes?: number;
  projects: Project[];
  onSave: (data: Omit<CalendarEvent, 'id'>) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export function EventModal({
  event,
  defaultDate,
  defaultStartMinutes,
  defaultEndMinutes,
  projects,
  onSave,
  onDelete,
  onClose,
}: Props) {
  const isEdit = !!event?.id;

  const [title, setTitle] = useState(event?.title ?? '');
  const [date, setDate] = useState(event?.date ?? defaultDate);
  const [allDay, setAllDay] = useState(event?.allDay ?? false);
  const [startMin, setStartMin] = useState(event?.startMinutes ?? defaultStartMinutes);
  const [endMin, setEndMin] = useState(event?.endMinutes ?? defaultEndMinutes ?? defaultStartMinutes + 60);
  const [projectId, setProjectId] = useState<string | null>(event?.projectId ?? null);
  const [projectSearch, setProjectSearch] = useState('');
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const titleRef = useRef<HTMLInputElement>(null);
  const projectPickerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (projectPickerRef.current && !projectPickerRef.current.contains(e.target as Node)) {
        setProjectPickerOpen(false);
        setProjectSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const handleStartChange = (val: string) => {
    const s = parseTime(val);
    setStartMin(s);
    if (endMin <= s) setEndMin(s + 60);
  };

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(projectSearch.toLowerCase())
  );

  const selectedProject = projectId ? projects.find(p => p.id === projectId) : null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      date,
      allDay,
      startMinutes: allDay ? undefined : startMin,
      endMinutes: allDay ? undefined : endMin,
      projectId,
      taskIds: event?.taskIds ?? [],
      endDate: event?.endDate ?? null,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 380, maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2>{isEdit ? 'Edytuj wydarzenie' : 'Nowe wydarzenie'}</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
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

          <div className="form-group">
            <label>Projekt</label>
            <div className="event-project-picker-wrap" ref={projectPickerRef}>
              <button
                type="button"
                className="event-project-picker-btn"
                onClick={() => setProjectPickerOpen(v => !v)}
              >
                {selectedProject ? selectedProject.name : 'Inbox'}
                <span className="event-project-picker-chevron">▾</span>
              </button>
              {projectPickerOpen && (
                <div className="event-project-picker-dropdown">
                  <input
                    className="event-project-search-input"
                    placeholder="Szukaj projektu…"
                    value={projectSearch}
                    onChange={e => setProjectSearch(e.target.value)}
                    autoFocus
                  />
                  <div className="event-project-list">
                    <button
                      type="button"
                      className={`event-project-option${projectId === null ? ' selected' : ''}`}
                      onClick={() => { setProjectId(null); setProjectPickerOpen(false); setProjectSearch(''); }}
                    >
                      Inbox
                    </button>
                    {filteredProjects.map(p => (
                      <button
                        key={p.id}
                        type="button"
                        className={`event-project-option${projectId === p.id ? ' selected' : ''}`}
                        onClick={() => { setProjectId(p.id); setProjectPickerOpen(false); setProjectSearch(''); }}
                      >
                        {p.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

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

          <div className="modal-footer">
            {isEdit && onDelete && (
              <button
                type="button"
                className="delete-task-btn"
                onClick={onDelete}
              >
                Usuń
              </button>
            )}
            <button type="submit" className="btn-primary">
              {isEdit ? 'Zapisz' : 'Dodaj'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
