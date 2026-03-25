import { useState, useRef, useEffect } from 'react';
import React from 'react';
import type { Area, Lifter, Project, Context, WorkBlock, CalendarEvent, BlockTemplate } from '../types';

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function parseTime(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return (h ?? 0) * 60 + (m ?? 0);
}

function toggleArr<T>(arr: T[], val: T): T[] {
  return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
}

interface Props {
  defaultDate: string;
  defaultStartMinutes: number;
  defaultEndMinutes: number;
  areas: Area[];
  lifters: Lifter[];
  projects: Project[];
  contexts: Context[];
  blockTemplates?: BlockTemplate[];
  onSaveBlock: (data: Omit<WorkBlock, 'id'>) => void;
  onSaveEvent: (data: Omit<CalendarEvent, 'id'>) => void;
  onClose: () => void;
}

export function CreateSlotModal({
  defaultDate,
  defaultStartMinutes,
  defaultEndMinutes,
  areas,
  lifters,
  projects,
  contexts,
  blockTemplates = [],
  onSaveBlock,
  onSaveEvent,
  onClose,
}: Props) {
  const [tab, setTab] = useState<'block' | 'event'>('block');
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, [tab]);

  // ── Block form state ────────────────────────────────────────────────────────
  const [blockTitle, setBlockTitle] = useState('');
  const [blockDate, setBlockDate] = useState(defaultDate);
  const [blockStartMin, setBlockStartMin] = useState(defaultStartMinutes);
  const [blockEndMin, setBlockEndMin] = useState(defaultEndMinutes);
  const [blockType, setBlockType] = useState<'auto' | 'manual'>('auto');
  const [areaIds, setAreaIds] = useState<string[]>([]);
  const [lifterIds, setLifterIds] = useState<string[]>([]);
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [contextIds, setContextIds] = useState<string[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  const applyTemplate = (templateId: string) => {
    const tpl = blockTemplates.find(t => t.id === templateId);
    if (!tpl) return;
    setSelectedTemplateId(templateId);
    setAreaIds(tpl.areaIds);
    setLifterIds(tpl.lifterIds);
    setProjectIds(tpl.projectIds);
    setContextIds(tpl.contextIds);
  };

  const handleBlockStartChange = (val: string) => {
    const s = parseTime(val);
    setBlockStartMin(s);
    if (blockEndMin <= s) setBlockEndMin(s + 60);
  };

  const filteredLifters = areaIds.length > 0
    ? lifters.filter(l => areaIds.includes(l.areaId))
    : lifters;

  const filteredBlockProjects = projects.filter(p => {
    if (areaIds.length > 0 && !areaIds.includes(p.areaId)) return false;
    if (lifterIds.length > 0 && p.lifterId && !lifterIds.includes(p.lifterId)) return false;
    return true;
  });

  const handleBlockSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!blockTitle.trim()) return;
    onSaveBlock({
      title: blockTitle.trim(),
      date: blockDate,
      startMinutes: blockStartMin,
      endMinutes: blockEndMin,
      blockType,
      taskIds: [],
      areaIds: blockType === 'manual' ? [] : areaIds,
      lifterIds: blockType === 'manual' ? [] : lifterIds,
      projectIds: blockType === 'manual' ? [] : projectIds,
      contextIds: blockType === 'manual' ? [] : contextIds,
    });
  };

  // ── Event form state ────────────────────────────────────────────────────────
  const [eventTitle, setEventTitle] = useState('');
  const [eventDate, setEventDate] = useState(defaultDate);
  const [allDay, setAllDay] = useState(false);
  const [eventStartMin, setEventStartMin] = useState(defaultStartMinutes);
  const [eventEndMin, setEventEndMin] = useState(defaultEndMinutes);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [projectSearch, setProjectSearch] = useState('');
  const [projectPickerOpen, setProjectPickerOpen] = useState(false);
  const projectPickerRef = useRef<HTMLDivElement>(null);

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

  const handleEventStartChange = (val: string) => {
    const s = parseTime(val);
    setEventStartMin(s);
    if (eventEndMin <= s) setEventEndMin(s + 60);
  };

  const filteredProjects = projects.filter(p =>
    p.name.toLowerCase().includes(projectSearch.toLowerCase())
  );
  const selectedProject = projectId ? projects.find(p => p.id === projectId) : null;

  const handleEventSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventTitle.trim()) return;
    onSaveEvent({
      title: eventTitle.trim(),
      date: eventDate,
      allDay,
      startMinutes: allDay ? undefined : eventStartMin,
      endMinutes: allDay ? undefined : eventEndMin,
      projectId,
      taskIds: [],
      endDate: null,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal"
        onClick={e => e.stopPropagation()}
        style={{ maxWidth: 420, maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}
      >
        <div className="modal-header">
          <h2>Nowy slot</h2>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Tabs */}
        <div className="create-slot-tabs">
          <button
            type="button"
            className={`create-slot-tab${tab === 'block' ? ' active' : ''}`}
            onClick={() => setTab('block')}
          >Blok</button>
          <button
            type="button"
            className={`create-slot-tab create-slot-tab-event${tab === 'event' ? ' active' : ''}`}
            onClick={() => setTab('event')}
          >Wydarzenie</button>
        </div>

        {/* ── Block form ── */}
        {tab === 'block' && (
          <form onSubmit={handleBlockSubmit} className="modal-body">
            <div className="form-group">
              <label>Tytuł</label>
              <input
                ref={titleRef}
                type="text"
                value={blockTitle}
                onChange={e => setBlockTitle(e.target.value)}
                placeholder="np. Praca głęboka"
                required
              />
            </div>

            <div className="form-group">
              <label>Data</label>
              <input type="date" value={blockDate} onChange={e => setBlockDate(e.target.value)} />
            </div>

            <div className="form-group agenda-time-row">
              <div>
                <label>Od</label>
                <input
                  type="time"
                  value={formatTime(blockStartMin)}
                  onChange={e => handleBlockStartChange(e.target.value)}
                />
              </div>
              <div>
                <label>Do</label>
                <input
                  type="time"
                  value={formatTime(blockEndMin)}
                  onChange={e => setBlockEndMin(parseTime(e.target.value))}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Typ bloku</label>
              <div className="agenda-block-type-toggle">
                <button
                  type="button"
                  className={`agenda-block-type-btn${blockType === 'auto' ? ' active' : ''}`}
                  onClick={() => setBlockType('auto')}
                >Automatyczny (filtr)</button>
                <button
                  type="button"
                  className={`agenda-block-type-btn${blockType === 'manual' ? ' active' : ''}`}
                  onClick={() => setBlockType('manual')}
                >Manualny</button>
              </div>
            </div>

            {blockType === 'auto' && blockTemplates.length > 0 && (
              <div className="form-group template-picker-row">
                <label>Szablon</label>
                <div className="template-picker-controls">
                  <select
                    className="template-picker-select"
                    value={selectedTemplateId ?? ''}
                    onChange={e => {
                      const val = e.target.value;
                      if (val) applyTemplate(val);
                      else { setSelectedTemplateId(null); }
                    }}
                  >
                    <option value="">Wybierz szablon…</option>
                    {blockTemplates.map(t => (
                      <option key={t.id} value={t.id}>{t.name}</option>
                    ))}
                  </select>
                  {selectedTemplateId && (
                    <button
                      type="button"
                      className="template-clear-btn"
                      onClick={() => setSelectedTemplateId(null)}
                      title="Wyczyść wybór szablonu"
                    >×</button>
                  )}
                </div>
              </div>
            )}

            {blockType === 'auto' && (
              <details className="form-group agenda-filters-details">
                <summary>Filtry</summary>

                {areas.length > 0 && (
                  <div className="agenda-filter-section">
                    <span className="agenda-filter-label">Obszary</span>
                    <div className="agenda-filter-checkboxes">
                      {areas.map(a => {
                        const active = areaIds.includes(a.id);
                        return (
                          <button
                            key={a.id}
                            type="button"
                            className={`agenda-filter-pill ${active ? 'active' : ''}`}
                            style={active
                              ? { background: a.color, borderColor: a.color }
                              : { borderColor: a.color, color: a.color }}
                            onClick={() => setAreaIds(prev => toggleArr(prev, a.id))}
                          >
                            {a.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}

                {filteredLifters.length > 0 && (
                  <div className="agenda-filter-section">
                    <span className="agenda-filter-label">Podobszary</span>
                    <div className="agenda-filter-checkboxes">
                      {filteredLifters.map(l => (
                        <button
                          key={l.id}
                          type="button"
                          className={`agenda-filter-pill ${lifterIds.includes(l.id) ? 'active' : ''}`}
                          onClick={() => setLifterIds(prev => toggleArr(prev, l.id))}
                        >
                          {l.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {filteredBlockProjects.length > 0 && (
                  <div className="agenda-filter-section">
                    <span className="agenda-filter-label">Projekty</span>
                    <div className="agenda-filter-checkboxes">
                      {filteredBlockProjects.map(p => (
                        <button
                          key={p.id}
                          type="button"
                          className={`agenda-filter-pill ${projectIds.includes(p.id) ? 'active' : ''}`}
                          onClick={() => setProjectIds(prev => toggleArr(prev, p.id))}
                        >
                          {p.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {contexts.length > 0 && (
                  <div className="agenda-filter-section">
                    <span className="agenda-filter-label">Konteksty</span>
                    <div className="agenda-filter-checkboxes">
                      {contexts.map(c => (
                        <button
                          key={c.id}
                          type="button"
                          className={`agenda-filter-pill ${contextIds.includes(c.id) ? 'active' : ''}`}
                          onClick={() => setContextIds(prev => toggleArr(prev, c.id))}
                        >
                          {c.icon} {c.name}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </details>
            )}

            <div className="modal-footer">
              <button type="submit" className="btn-primary">Dodaj</button>
            </div>
          </form>
        )}

        {/* ── Event form ── */}
        {tab === 'event' && (
          <form onSubmit={handleEventSubmit} className="modal-body">
            <div className="form-group">
              <label>Tytuł</label>
              <input
                ref={titleRef}
                type="text"
                value={eventTitle}
                onChange={e => setEventTitle(e.target.value)}
                placeholder="np. Spotkanie z zespołem"
                required
              />
            </div>

            <div className="form-group">
              <label>Data</label>
              <input type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
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
                    value={formatTime(eventStartMin)}
                    onChange={e => handleEventStartChange(e.target.value)}
                  />
                </div>
                <div>
                  <label>Do</label>
                  <input
                    type="time"
                    value={formatTime(eventEndMin)}
                    onChange={e => setEventEndMin(parseTime(e.target.value))}
                  />
                </div>
              </div>
            )}

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

            <div className="modal-footer">
              <button type="submit" className="btn-primary">Dodaj</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
