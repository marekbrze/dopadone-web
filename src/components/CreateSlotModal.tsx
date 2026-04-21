import { useState, useRef, useEffect } from 'react';
import React from 'react';
import type { Area, Effort, Lifter, Project, Context, WorkBlock, BlockTemplate } from '../types';
import { EventForm, type EventFormData } from './EventForm';

const ENERGY_LEVELS: { value: Effort; label: string; color: string }[] = [
  { value: 'low',    label: 'Niski',   color: '#5a7a5e' },
  { value: 'medium', label: 'Średni',  color: '#a07830' },
  { value: 'high',   label: 'Wysoki',  color: '#a33a2a' },
];

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
  defaultTab?: 'block' | 'event';
  defaultAllDay?: boolean;
  onSaveBlock: (data: Omit<WorkBlock, 'id'>) => void;
  onSaveEvent: (data: EventFormData) => void;
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
  defaultTab,
  defaultAllDay,
  onSaveBlock,
  onSaveEvent,
  onClose,
}: Props) {
  const [tab, setTab] = useState<'block' | 'event'>(defaultTab ?? 'block');
  const titleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const [title, setTitle] = useState('');

  const [blockDate, setBlockDate] = useState(defaultDate);
  const [blockStartMin, setBlockStartMin] = useState(defaultStartMinutes);
  const [blockEndMin, setBlockEndMin] = useState(defaultEndMinutes);
  const [blockType, setBlockType] = useState<'auto' | 'manual'>('auto');
  const [areaIds, setAreaIds] = useState<string[]>([]);
  const [lifterIds, setLifterIds] = useState<string[]>([]);
  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [contextIds, setContextIds] = useState<string[]>([]);
  const [effortLevels, setEffortLevels] = useState<Effort[]>([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);

  const applyTemplate = (templateId: string) => {
    const tpl = blockTemplates.find(t => t.id === templateId);
    if (!tpl) return;
    setSelectedTemplateId(templateId);
    setAreaIds(tpl.areaIds);
    setLifterIds(tpl.lifterIds);
    setProjectIds(tpl.projectIds);
    setContextIds(tpl.contextIds);
    setEffortLevels(tpl.effortLevels ?? []);
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
    if (!title.trim()) return;
    onSaveBlock({
      title: title.trim(),
      date: blockDate,
      startMinutes: blockStartMin,
      endMinutes: blockEndMin,
      blockType,
      taskIds: [],
      areaIds: blockType === 'manual' ? [] : areaIds,
      lifterIds: blockType === 'manual' ? [] : lifterIds,
      projectIds: blockType === 'manual' ? [] : projectIds,
      contextIds: blockType === 'manual' ? [] : contextIds,
      effortLevels: blockType === 'manual' ? [] : effortLevels,
    });
  };

  const handleEventSave = (data: EventFormData) => {
    onSaveEvent({ ...data, title: data.title || title.trim() });
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

        {tab === 'block' && (
          <div className="modal-body" style={{ paddingBottom: 0 }}>
            <div className="form-group">
              <label>Tytuł</label>
              <input
                ref={titleRef}
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="np. Praca głęboka"
                required
              />
            </div>
          </div>
        )}

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

        {tab === 'block' && (
          <form onSubmit={handleBlockSubmit} className="modal-body">
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

                <div className="agenda-filter-section">
                  <span className="agenda-filter-label">Energia</span>
                  <div className="agenda-filter-checkboxes">
                    {ENERGY_LEVELS.map(e => {
                      const active = effortLevels.includes(e.value);
                      return (
                        <button
                          key={e.value}
                          type="button"
                          className={`agenda-filter-pill ${active ? 'active' : ''}`}
                          style={active ? { background: e.color, borderColor: e.color } : { borderColor: e.color, color: e.color }}
                          onClick={() => setEffortLevels(prev => toggleArr(prev, e.value))}
                        >
                          {e.label}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </details>
            )}

            <div className="modal-footer">
              <button type="submit" className="btn-primary">Dodaj</button>
            </div>
          </form>
        )}

        {tab === 'event' && (
          <EventForm
            mode="create"
            presentation="modal"
            defaultDate={defaultDate}
            defaultStartMinutes={defaultStartMinutes}
            defaultEndMinutes={defaultEndMinutes}
            defaultAllDay={defaultAllDay}
            projects={projects}
            onSave={handleEventSave}
          />
        )}
      </div>
    </div>
  );
}
