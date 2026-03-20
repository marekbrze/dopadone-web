import { useState, useEffect, useRef } from 'react';
import type { Area, Lifter, Project, Context, WorkBlock } from '../types';

interface Props {
  areas: Area[];
  lifters: Lifter[];
  projects: Project[];
  contexts: Context[];
  workBlocks: WorkBlock[];
  onAdd: (block: Omit<WorkBlock, 'id'>) => void;
  onUpdate: (id: string, updates: Partial<WorkBlock>) => void;
  onDelete: (id: string) => void;
}

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getWeekDates(anchor: string): string[] {
  const d = new Date(anchor + 'T00:00:00');
  const day = d.getDay(); // 0=Sun
  const mon = new Date(d);
  mon.setDate(d.getDate() - ((day + 6) % 7)); // Monday
  return Array.from({ length: 7 }, (_, i) => {
    const nd = new Date(mon);
    nd.setDate(mon.getDate() + i);
    return toDateString(nd);
  });
}

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function parseTime(value: string): number {
  const [h, m] = value.split(':').map(Number);
  return h * 60 + m;
}

function snap15(minutes: number): number {
  return Math.round(minutes / 15) * 15;
}

function getBlockColor(block: WorkBlock, areas: Area[]): string {
  if (block.color) return block.color;
  const area = areas.find(a => a.id === block.areaIds[0]);
  return area?.color ?? '#5c4a38';
}

const DAY_LABELS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'];

// ── WorkBlockModal ───────────────────────────────────────────────────────────

interface ModalProps {
  block: Partial<WorkBlock> | null; // null = create new
  defaultDate: string;
  defaultStartMinutes: number;
  defaultEndMinutes?: number;
  areas: Area[];
  lifters: Lifter[];
  projects: Project[];
  contexts: Context[];
  onSave: (data: Omit<WorkBlock, 'id'>) => void;
  onDelete?: () => void;
  onClose: () => void;
}

function WorkBlockModal({
  block,
  defaultDate,
  defaultStartMinutes,
  defaultEndMinutes,
  areas,
  lifters,
  projects,
  contexts,
  onSave,
  onDelete,
  onClose,
}: ModalProps) {
  const isEdit = !!block?.id;

  const [title, setTitle] = useState(block?.title ?? '');
  const [date, setDate] = useState(block?.date ?? defaultDate);
  const [startMin, setStartMin] = useState(block?.startMinutes ?? defaultStartMinutes);
  const [endMin, setEndMin] = useState(block?.endMinutes ?? defaultEndMinutes ?? defaultStartMinutes + 60);
  const [areaIds, setAreaIds] = useState<string[]>(block?.areaIds ?? []);
  const [lifterIds, setLifterIds] = useState<string[]>(block?.lifterIds ?? []);
  const [projectIds, setProjectIds] = useState<string[]>(block?.projectIds ?? []);
  const [contextIds, setContextIds] = useState<string[]>(block?.contextIds ?? []);
  const titleRef = useRef<HTMLInputElement>(null);

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
      areaIds,
      lifterIds,
      projectIds,
      contextIds,
    });
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} style={{ maxWidth: 420, maxHeight: 'calc(100vh - 120px)', overflowY: 'auto' }}>
        <div className="modal-header">
          <h2>{isEdit ? 'Edytuj blok' : 'Nowy blok'}</h2>
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

          <details className="form-group agenda-filters-details">
            <summary>Filtry</summary>

            {areas.length > 0 && (
              <div className="agenda-filter-section">
                <span className="agenda-filter-label">Obszary</span>
                <div className="agenda-filter-checkboxes">
                  {areas.map(a => (
                    <label key={a.id} className="agenda-checkbox-label">
                      <input
                        type="checkbox"
                        checked={areaIds.includes(a.id)}
                        onChange={() => setAreaIds(prev => toggleArr(prev, a.id))}
                      />
                      <span style={{ color: a.color }}>{a.name}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {filteredLifters.length > 0 && (
              <div className="agenda-filter-section">
                <span className="agenda-filter-label">Podobszary</span>
                <div className="agenda-filter-checkboxes">
                  {filteredLifters.map(l => (
                    <label key={l.id} className="agenda-checkbox-label">
                      <input
                        type="checkbox"
                        checked={lifterIds.includes(l.id)}
                        onChange={() => setLifterIds(prev => toggleArr(prev, l.id))}
                      />
                      {l.name}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {filteredProjects.length > 0 && (
              <div className="agenda-filter-section">
                <span className="agenda-filter-label">Projekty</span>
                <div className="agenda-filter-checkboxes">
                  {filteredProjects.map(p => (
                    <label key={p.id} className="agenda-checkbox-label">
                      <input
                        type="checkbox"
                        checked={projectIds.includes(p.id)}
                        onChange={() => setProjectIds(prev => toggleArr(prev, p.id))}
                      />
                      {p.name}
                    </label>
                  ))}
                </div>
              </div>
            )}

            {contexts.length > 0 && (
              <div className="agenda-filter-section">
                <span className="agenda-filter-label">Konteksty</span>
                <div className="agenda-filter-checkboxes">
                  {contexts.map(c => (
                    <label key={c.id} className="agenda-checkbox-label">
                      <input
                        type="checkbox"
                        checked={contextIds.includes(c.id)}
                        onChange={() => setContextIds(prev => toggleArr(prev, c.id))}
                      />
                      {c.icon} {c.name}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </details>

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

// ── AgendaView ───────────────────────────────────────────────────────────────

export function AgendaView({ areas, lifters, projects, contexts, workBlocks, onAdd, onUpdate, onDelete }: Props) {
  const today = toDateString(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'day'>('week');
  const [anchorDate, setAnchorDate] = useState(today);
  const [editingBlock, setEditingBlock] = useState<WorkBlock | null>(null);
  const [pendingSlot, setPendingSlot] = useState<{ date: string; startMinutes: number; endMinutes: number } | null>(null);
  const [dragState, setDragState] = useState<{ date: string; startMinutes: number; currentMinutes: number } | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Scroll to current hour on mount
  useEffect(() => {
    if (gridRef.current) {
      const now = new Date();
      const minutes = now.getHours() * 60 + now.getMinutes();
      gridRef.current.scrollTop = Math.max(0, minutes - 120);
    }
  }, []);

  // Global mouseup to finish drag even if cursor leaves the column
  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (dragState) {
        const startMin = Math.min(dragState.startMinutes, dragState.currentMinutes);
        const endMin = Math.max(dragState.startMinutes, dragState.currentMinutes);
        const finalEnd = endMin - startMin < 15 ? startMin + 60 : endMin;
        setPendingSlot({ date: dragState.date, startMinutes: startMin, endMinutes: finalEnd });
        setDragState(null);
      }
    };
    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [dragState]);

  const visibleDates = viewMode === 'week' ? getWeekDates(anchorDate) : [anchorDate];

  const navigate = (dir: -1 | 1) => {
    const d = new Date(anchorDate + 'T00:00:00');
    if (viewMode === 'week') {
      d.setDate(d.getDate() + dir * 7);
    } else {
      d.setDate(d.getDate() + dir);
    }
    setAnchorDate(toDateString(d));
  };

  const dateLabel = () => {
    if (viewMode === 'week') {
      const dates = getWeekDates(anchorDate);
      const first = new Date(dates[0] + 'T00:00:00');
      const last = new Date(dates[6] + 'T00:00:00');
      const fmt = (d: Date) => d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' });
      return `${fmt(first)} – ${fmt(last)} ${first.getFullYear()}`;
    }
    return new Date(anchorDate + 'T00:00:00').toLocaleDateString('pl-PL', {
      weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
    });
  };

  const getMinutesFromEvent = (e: React.MouseEvent<HTMLDivElement>): number => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    return Math.max(0, Math.min(snap15(y), 24 * 60 - 15));
  };

  const handleMouseDown = (date: string, e: React.MouseEvent<HTMLDivElement>) => {
    if ((e.target as HTMLElement).closest('.agenda-block')) return;
    e.preventDefault();
    const snapped = getMinutesFromEvent(e);
    setDragState({ date, startMinutes: snapped, currentMinutes: snapped });
  };

  const handleMouseMove = (date: string, e: React.MouseEvent<HTMLDivElement>) => {
    if (!dragState || dragState.date !== date) return;
    const snapped = getMinutesFromEvent(e);
    setDragState(prev => prev ? { ...prev, currentMinutes: snapped } : null);
  };

  const finishDrag = (date: string) => {
    if (!dragState || dragState.date !== date) return;
    const startMin = Math.min(dragState.startMinutes, dragState.currentMinutes);
    const endMin = Math.max(dragState.startMinutes, dragState.currentMinutes);
    const finalEnd = endMin - startMin < 15 ? startMin + 60 : endMin;
    setPendingSlot({ date, startMinutes: startMin, endMinutes: finalEnd });
    setDragState(null);
  };

  const handleSave = (data: Omit<WorkBlock, 'id'>) => {
    if (editingBlock) {
      onUpdate(editingBlock.id, data);
      setEditingBlock(null);
    } else {
      onAdd(data);
      setPendingSlot(null);
    }
  };

  const handleDelete = () => {
    if (editingBlock) {
      onDelete(editingBlock.id);
      setEditingBlock(null);
    }
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="agenda-view">
      {/* Toolbar */}
      <div className="agenda-toolbar">
        <button className="agenda-nav-btn" onClick={() => navigate(-1)}>←</button>
        <button className="agenda-nav-btn" onClick={() => navigate(1)}>→</button>
        <button className="agenda-today-btn" onClick={() => setAnchorDate(today)}>Dziś</button>
        <span className="agenda-date-label">{dateLabel()}</span>
        <div className="agenda-view-toggle">
          <button
            className={`agenda-toggle-btn ${viewMode === 'week' ? 'active' : ''}`}
            onClick={() => setViewMode('week')}
          >Tydzień</button>
          <button
            className={`agenda-toggle-btn ${viewMode === 'day' ? 'active' : ''}`}
            onClick={() => setViewMode('day')}
          >Dzień</button>
        </div>
      </div>

      {/* Grid */}
      <div className="agenda-grid-wrap" ref={gridRef}>
        <div
          className="agenda-grid"
          style={{ gridTemplateColumns: `56px repeat(${visibleDates.length}, 1fr)` }}
        >
          {/* Time axis header (empty corner) */}
          <div className="agenda-time-axis-header" />

          {/* Day headers */}
          {visibleDates.map((d, i) => {
            const dt = new Date(d + 'T00:00:00');
            const isToday = d === today;
            return (
              <div key={d} className={`agenda-day-header ${isToday ? 'today' : ''}`}>
                <span className="agenda-day-name">{DAY_LABELS[i % 7]}</span>
                <span className="agenda-day-num">{dt.getDate()}</span>
              </div>
            );
          })}

          {/* Time axis */}
          <div className="agenda-time-axis">
            {hours.map(h => (
              <div key={h} className="agenda-hour-label" style={{ top: `${h * 60}px` }}>
                {h.toString().padStart(2, '0')}:00
              </div>
            ))}
          </div>

          {/* Day columns */}
          {visibleDates.map((d) => {
            const dayBlocks = workBlocks.filter(b => b.date === d);
            return (
              <div
                key={d}
                className="agenda-day-col"
                onMouseDown={(e) => handleMouseDown(d, e)}
                onMouseMove={(e) => handleMouseMove(d, e)}
                onMouseUp={() => finishDrag(d)}
              >
                {/* Hour lines */}
                {hours.map(h => (
                  <div
                    key={h}
                    className="agenda-hour-line"
                    style={{ top: `${h * 60}px` }}
                  />
                ))}

                {/* Drag preview */}
                {dragState?.date === d && dragState.startMinutes !== dragState.currentMinutes && (
                  <div
                    className="agenda-drag-preview"
                    style={{
                      top: `${Math.min(dragState.startMinutes, dragState.currentMinutes)}px`,
                      height: `${Math.abs(dragState.currentMinutes - dragState.startMinutes)}px`,
                    }}
                  />
                )}

                {/* Work blocks */}
                {dayBlocks.map(block => {
                  const color = getBlockColor(block, areas);
                  const height = Math.max(block.endMinutes - block.startMinutes, 20);
                  return (
                    <div
                      key={block.id}
                      className="agenda-block"
                      style={{
                        top: `${block.startMinutes}px`,
                        height: `${height}px`,
                        background: color + '33',
                        borderLeft: `3px solid ${color}`,
                      }}
                      onClick={e => {
                        e.stopPropagation();
                        setEditingBlock(block);
                      }}
                    >
                      <span className="agenda-block-title">{block.title}</span>
                      <span className="agenda-block-time">
                        {formatTime(block.startMinutes)}–{formatTime(block.endMinutes)}
                      </span>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      {/* Modal: create */}
      {pendingSlot && !editingBlock && (
        <WorkBlockModal
          block={null}
          defaultDate={pendingSlot.date}
          defaultStartMinutes={pendingSlot.startMinutes}
          defaultEndMinutes={pendingSlot.endMinutes}
          areas={areas}
          lifters={lifters}
          projects={projects}
          contexts={contexts}
          onSave={handleSave}
          onClose={() => setPendingSlot(null)}
        />
      )}

      {/* Modal: edit */}
      {editingBlock && (
        <WorkBlockModal
          block={editingBlock}
          defaultDate={editingBlock.date}
          defaultStartMinutes={editingBlock.startMinutes}
          areas={areas}
          lifters={lifters}
          projects={projects}
          contexts={contexts}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setEditingBlock(null)}
        />
      )}
    </div>
  );
}
