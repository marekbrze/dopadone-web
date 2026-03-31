import React, { useState, useEffect, useRef } from 'react';
import type { Area, Effort, Lifter, Project, Context, WorkBlock, BlockTemplate } from '../types';

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
  return h * 60 + m;
}

export interface WorkBlockModalProps {
  block: Partial<WorkBlock> | null; // null = create new
  defaultDate: string;
  defaultStartMinutes: number;
  defaultEndMinutes?: number;
  areas: Area[];
  lifters: Lifter[];
  projects: Project[];
  contexts: Context[];
  blockTemplates?: BlockTemplate[];
  onSave: (data: Omit<WorkBlock, 'id'>) => void;
  onDelete?: () => void;
  onClose: () => void;
}

export function WorkBlockModal({
  block,
  defaultDate,
  defaultStartMinutes,
  defaultEndMinutes,
  areas,
  lifters,
  projects,
  contexts,
  blockTemplates = [],
  onSave,
  onDelete,
  onClose,
}: WorkBlockModalProps) {
  const isEdit = !!block?.id;

  const [title, setTitle] = useState(block?.title ?? '');
  const [date, setDate] = useState(block?.date ?? defaultDate);
  const [startMin, setStartMin] = useState(block?.startMinutes ?? defaultStartMinutes);
  const [endMin, setEndMin] = useState(block?.endMinutes ?? defaultEndMinutes ?? defaultStartMinutes + 60);
  const [blockType, setBlockType] = useState<'auto' | 'manual'>(block?.blockType ?? 'auto');
  const [areaIds, setAreaIds] = useState<string[]>(block?.areaIds ?? []);
  const [lifterIds, setLifterIds] = useState<string[]>(block?.lifterIds ?? []);
  const [projectIds, setProjectIds] = useState<string[]>(block?.projectIds ?? []);
  const [contextIds, setContextIds] = useState<string[]>(block?.contextIds ?? []);
  const [effortLevels, setEffortLevels] = useState<Effort[]>(block?.effortLevels ?? []);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const titleRef = useRef<HTMLInputElement>(null);

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

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  const handleStartChange = (val: string) => {
    const s = parseTime(val);
    setStartMin(s);
    if (endMin <= s) setEndMin(s + 60);
  };

  const filteredLifters = areaIds.length > 0
    ? lifters.filter(l => areaIds.includes(l.areaId))
    : lifters;

  const filteredProjects = projects.filter(p => {
    if (areaIds.length > 0 && !areaIds.includes(p.areaId)) return false;
    if (lifterIds.length > 0 && p.lifterId && !lifterIds.includes(p.lifterId)) return false;
    return true;
  });

  function toggleArr<T>(arr: T[], val: T): T[] {
    return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    onSave({
      title: title.trim(),
      date,
      startMinutes: startMin,
      endMinutes: endMin,
      blockType,
      taskIds: block?.taskIds ?? [],
      areaIds: blockType === 'manual' ? [] : areaIds,
      lifterIds: blockType === 'manual' ? [] : lifterIds,
      projectIds: blockType === 'manual' ? [] : projectIds,
      contextIds: blockType === 'manual' ? [] : contextIds,
      effortLevels: blockType === 'manual' ? [] : effortLevels,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420, maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2>{isEdit ? 'Edytuj blok' : 'Nowy blok'}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Zamknij">✕</button>
        </div>
        <form onSubmit={handleSubmit} className="modal-body">
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

          <div className="form-group">
            <label>Data</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} />
          </div>

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

          <div className="form-group">
            <label>Typ bloku</label>
            <div className="agenda-block-type-toggle">
              <button
                type="button"
                className={`agenda-block-type-btn${blockType === 'auto' ? ' active' : ''}`}
                aria-pressed={blockType === 'auto'}
                onClick={() => setBlockType('auto')}
              >Automatyczny (filtr)</button>
              <button
                type="button"
                className={`agenda-block-type-btn${blockType === 'manual' ? ' active' : ''}`}
                aria-pressed={blockType === 'manual'}
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
                    else setSelectedTemplateId(null);
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
                    aria-label="Wyczyść wybór szablonu"
                  >×</button>
                )}
              </div>
            </div>
          )}

          {blockType === 'auto' && (
          <details className="form-group agenda-filters-details" open>
            <summary>Filtry</summary>

            {areas.length > 0 && (
              <div className="agenda-filter-section" role="group" aria-labelledby="filter-label-areas">
                <span id="filter-label-areas" className="agenda-filter-label">Obszary</span>
                <div className="agenda-filter-checkboxes">
                  {areas.map(a => {
                    const active = areaIds.includes(a.id);
                    return (
                      <button
                        key={a.id}
                        type="button"
                        className={`agenda-filter-pill ${active ? 'active' : ''}`}
                        aria-pressed={active}
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
              <div className="agenda-filter-section" role="group" aria-labelledby="filter-label-lifters">
                <span id="filter-label-lifters" className="agenda-filter-label">Podobszary</span>
                <div className="agenda-filter-checkboxes">
                  {filteredLifters.map(l => (
                    <button
                      key={l.id}
                      type="button"
                      className={`agenda-filter-pill ${lifterIds.includes(l.id) ? 'active' : ''}`}
                      aria-pressed={lifterIds.includes(l.id)}
                      onClick={() => setLifterIds(prev => toggleArr(prev, l.id))}
                    >
                      {l.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {filteredProjects.length > 0 && (
              <div className="agenda-filter-section" role="group" aria-labelledby="filter-label-projects">
                <span id="filter-label-projects" className="agenda-filter-label">Projekty</span>
                <div className="agenda-filter-checkboxes">
                  {filteredProjects.map(p => (
                    <button
                      key={p.id}
                      type="button"
                      className={`agenda-filter-pill ${projectIds.includes(p.id) ? 'active' : ''}`}
                      aria-pressed={projectIds.includes(p.id)}
                      onClick={() => setProjectIds(prev => toggleArr(prev, p.id))}
                    >
                      {p.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {contexts.length > 0 && (
              <div className="agenda-filter-section" role="group" aria-labelledby="filter-label-contexts">
                <span id="filter-label-contexts" className="agenda-filter-label">Konteksty</span>
                <div className="agenda-filter-checkboxes">
                  {contexts.map(c => (
                    <button
                      key={c.id}
                      type="button"
                      className={`agenda-filter-pill ${contextIds.includes(c.id) ? 'active' : ''}`}
                      aria-pressed={contextIds.includes(c.id)}
                      onClick={() => setContextIds(prev => toggleArr(prev, c.id))}
                    >
                      {c.icon} {c.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="agenda-filter-section" role="group" aria-labelledby="filter-label-energy">
              <span id="filter-label-energy" className="agenda-filter-label">Energia</span>
              <div className="agenda-filter-checkboxes">
                {ENERGY_LEVELS.map(e => {
                  const active = effortLevels.includes(e.value);
                  return (
                    <button
                      key={e.value}
                      type="button"
                      className={`agenda-filter-pill ${active ? 'active' : ''}`}
                      aria-pressed={active}
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
            {isEdit && onDelete && (
              <button
                type="button"
                className="delete-task-btn"
                onClick={onDelete}
              >
                Usuń blok
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
