import React, { useState, useEffect, useRef } from 'react';
import type { Area, Lifter, Project, Context, WorkBlock, Task, CalendarEvent, BlockTemplate } from '../types';
import { TaskDetailPanel } from './TaskDetailPanel';
import { EventDetailPanel } from './EventDetailPanel';
import { EventModal } from './EventModal';
import { CreateSlotModal } from './CreateSlotModal';

interface Props {
  areas: Area[];
  lifters: Lifter[];
  projects: Project[];
  contexts: Context[];
  tasks: Task[];
  workBlocks: WorkBlock[];
  events: CalendarEvent[];
  blockTemplates?: BlockTemplate[];
  onAdd: (block: Omit<WorkBlock, 'id'>) => void;
  onUpdate: (id: string, updates: Partial<WorkBlock>) => void;
  onDelete: (id: string) => void;
  onDuplicate: (id: string) => void;
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onDeleteTask: (id: string) => void;
  onCompleteWithNextAction: (task: Task, nextActionName: string) => void;
  onAddInboxTask: (name: string) => Promise<string>;
  onAddEvent: (data: Omit<CalendarEvent, 'id'>) => Promise<CalendarEvent>;
  onUpdateEvent: (id: string, updates: Partial<CalendarEvent>) => Promise<void>;
  onDeleteEvent: (id: string) => Promise<void>;
  onAddEventTask: (eventId: string, name: string) => Promise<void>;
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

const EVENT_COLOR = '#b8542a';

function isEventOnDate(event: CalendarEvent, dateStr: string): boolean {
  if (event.date === dateStr) return true;
  if (event.endDate && event.date <= dateStr && dateStr <= event.endDate) return true;
  return false;
}

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
  blockTemplates?: BlockTemplate[];
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
  blockTemplates = [],
  onSave,
  onDelete,
  onClose,
}: ModalProps) {
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

            {filteredProjects.length > 0 && (
              <div className="agenda-filter-section">
                <span className="agenda-filter-label">Projekty</span>
                <div className="agenda-filter-checkboxes">
                  {filteredProjects.map(p => (
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

function isManualBlock(block: WorkBlock): boolean {
  return block.blockType === 'manual';
}

function getMatchingTasks(block: WorkBlock, tasks: Task[], projects: Project[]): Task[] {
  return tasks.filter(task => {
    if (task.done) return false;
    const project = projects.find(p => p.id === task.projectId);
    if (!project) return false;

    if (block.contextIds.length > 0 && !block.contextIds.includes(task.contextId ?? '')) return false;
    if (block.projectIds.length > 0) return block.projectIds.includes(task.projectId ?? '');
    if (block.lifterIds.length > 0 && (!project.lifterId || !block.lifterIds.includes(project.lifterId))) return false;
    if (block.areaIds.length > 0 && !block.areaIds.includes(project.areaId)) return false;
    return true;
  });
}

function getMatchingDoneTasks(block: WorkBlock, tasks: Task[], projects: Project[]): Task[] {
  return tasks.filter(task => {
    if (!task.done) return false;
    const project = projects.find(p => p.id === task.projectId);
    if (!project) return false;

    if (block.contextIds.length > 0 && !block.contextIds.includes(task.contextId ?? '')) return false;
    if (block.projectIds.length > 0) return block.projectIds.includes(task.projectId ?? '');
    if (block.lifterIds.length > 0 && (!project.lifterId || !block.lifterIds.includes(project.lifterId))) return false;
    if (block.areaIds.length > 0 && !block.areaIds.includes(project.areaId)) return false;
    return true;
  });
}

export function AgendaView({ areas, lifters, projects, contexts, tasks, workBlocks, events, blockTemplates = [], onAdd, onUpdate, onDelete, onDuplicate, onUpdateTask, onDeleteTask, onCompleteWithNextAction, onAddInboxTask, onAddEvent, onUpdateEvent, onDeleteEvent, onAddEventTask }: Props) {
  const today = toDateString(new Date());
  const [viewMode, setViewMode] = useState<'week' | 'day'>('week');
  const [anchorDate, setAnchorDate] = useState(today);
  const [editingBlock, setEditingBlock] = useState<WorkBlock | null>(null);
  const [editingEvent, setEditingEvent] = useState<CalendarEvent | null>(null);
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const selectedBlock = selectedBlockId ? workBlocks.find(b => b.id === selectedBlockId) ?? null : null;
  const [pendingSlot, setPendingSlot] = useState<{ date: string; startMinutes: number; endMinutes: number } | null>(null);
  const [pendingAllDayDate, setPendingAllDayDate] = useState<string | null>(null);
  const [dragState, setDragState] = useState<{ date: string; startMinutes: number; currentMinutes: number } | null>(null);
  const [blockDragState, setBlockDragState] = useState<{
    blockId: string;
    originalDate: string;
    targetDate: string;
    offsetMinutes: number;
    currentMinutes: number;
    duration: number;
    startClientY: number;
    hasMoved: boolean;
  } | null>(null);
  const dragMovedRef = useRef(false);
  const [taskDragId, setTaskDragId] = useState<string | null>(null);
  const [leftPanelSearch, setLeftPanelSearch] = useState('');
  type TaskGrouping = 'area' | 'context';
  const [leftPanelGrouping, setLeftPanelGrouping] = useState<TaskGrouping>('area');
  const [dropTargetActive, setDropTargetActive] = useState(false);
  const [newBlockTaskName, setNewBlockTaskName] = useState('');
  const [showBlockDone, setShowBlockDone] = useState(false);
  const [nowMinutes, setNowMinutes] = useState(() => {
    const n = new Date();
    return n.getHours() * 60 + n.getMinutes();
  });
  const gridRef = useRef<HTMLDivElement>(null);

  // Auto-close panel when selected block is deleted
  useEffect(() => {
    if (selectedBlockId && !workBlocks.find(b => b.id === selectedBlockId)) {
      setSelectedBlockId(null);
      setSelectedTaskId(null);
    }
  }, [workBlocks, selectedBlockId]);

  // Reset done section when switching blocks
  useEffect(() => { setShowBlockDone(false); }, [selectedBlockId]);

  // Clear selected task if it no longer exists
  useEffect(() => {
    if (selectedTaskId && !tasks.find(t => t.id === selectedTaskId)) {
      setSelectedTaskId(null);
    }
  }, [tasks, selectedTaskId]);

  // Clear selected event if it no longer exists
  useEffect(() => {
    if (selectedEventId && !events.find(e => e.id === selectedEventId)) {
      setSelectedEventId(null);
    }
  }, [events, selectedEventId]);

  // Cancel block drag on global mouseup (e.g. released outside columns)
  useEffect(() => {
    const up = () => {
      if (blockDragState) {
        setBlockDragState(null);
        dragMovedRef.current = false;
      }
    };
    window.addEventListener('mouseup', up);
    return () => window.removeEventListener('mouseup', up);
  }, [blockDragState]);

  const isManual = selectedBlock ? isManualBlock(selectedBlock) : false;

  const matchingTasks = (!isManual && selectedBlock)
    ? getMatchingTasks(selectedBlock, tasks, projects)
    : [];

  const matchingDoneTasks = (!isManual && selectedBlock)
    ? getMatchingDoneTasks(selectedBlock, tasks, projects)
    : [];

  const pinnedTasks = (isManual && selectedBlock)
    ? (selectedBlock.taskIds ?? []).map(id => tasks.find(t => t.id === id)).filter((t): t is Task => t !== undefined)
    : [];

  const pinnedUndoneTasks = pinnedTasks.filter(t => !t.done);
  const pinnedDoneTasks   = pinnedTasks.filter(t => t.done);

  const pinnedTasksTotalDuration = pinnedTasks.reduce((sum, t) => sum + (t.duration ?? 0), 0);
  const selectedBlockDuration = selectedBlock ? selectedBlock.endMinutes - selectedBlock.startMinutes : 0;
  const pinnedDurationOverflow = isManual && pinnedTasksTotalDuration > 0 && pinnedTasksTotalDuration > selectedBlockDuration;

  const allUndoneTasks = (isManual && selectedBlock)
    ? tasks.filter(t =>
        !t.done &&
        !(selectedBlock.taskIds ?? []).includes(t.id) &&
        (leftPanelSearch === '' || t.name.toLowerCase().includes(leftPanelSearch.toLowerCase()))
      )
    : [];

  type LifterGroup = { lifterId: string | null; lifterName: string; lifterOrder: number; tasks: Task[] };
  type AreaGroup = { areaId: string | null; areaName: string; areaOrder: number; lifters: LifterGroup[] };

  const groupedTasks: AreaGroup[] = React.useMemo(() => {
    if (!isManual || !selectedBlock) return [];
    const areaMap = new Map<string, AreaGroup>();
    for (const task of allUndoneTasks) {
      const project = projects.find(p => p.id === task.projectId);
      const areaId = project?.areaId ?? null;
      const lifterId = project?.lifterId ?? null;
      const area = areas.find(a => a.id === areaId);
      const lifter = lifters.find(l => l.id === lifterId);
      const areaKey = areaId ?? '__no_area__';
      if (!areaMap.has(areaKey)) {
        areaMap.set(areaKey, {
          areaId,
          areaName: area?.name ?? 'Bez obszaru',
          areaOrder: area?.order ?? 999,
          lifters: [],
        });
      }
      const areaGroup = areaMap.get(areaKey)!;
      let lifterGroup = areaGroup.lifters.find(l => l.lifterId === lifterId);
      if (!lifterGroup) {
        lifterGroup = { lifterId, lifterName: lifter?.name ?? 'Bez podobszaru', lifterOrder: 999, tasks: [] };
        areaGroup.lifters.push(lifterGroup);
      }
      lifterGroup.tasks.push(task);
    }
    const result = [...areaMap.values()];
    result.sort((a, b) => a.areaOrder - b.areaOrder);
    result.forEach(ag => ag.lifters.sort((a, b) => a.lifterOrder - b.lifterOrder));
    return result;
  }, [allUndoneTasks, projects, areas, lifters, isManual, selectedBlock]);

  type ContextGroup = { contextId: string | null; contextName: string; contextIcon: string; tasks: Task[] };

  const groupedByContext: ContextGroup[] = React.useMemo(() => {
    if (!isManual || !selectedBlock) return [];
    const contextMap = new Map<string, ContextGroup>();
    for (const task of allUndoneTasks) {
      const contextId = task.contextId ?? null;
      const context = contexts.find(c => c.id === contextId);
      const key = contextId ?? '__no_context__';
      if (!contextMap.has(key)) {
        contextMap.set(key, {
          contextId,
          contextName: context?.name ?? 'Bez kontekstu',
          contextIcon: context?.icon ?? '',
          tasks: [],
        });
      }
      contextMap.get(key)!.tasks.push(task);
    }
    const result = [...contextMap.values()];
    result.sort((a, b) => {
      if (a.contextId === null) return 1;
      if (b.contextId === null) return -1;
      return a.contextName.localeCompare(b.contextName);
    });
    return result;
  }, [allUndoneTasks, contexts, isManual, selectedBlock]);

  const handleAddTaskToBlock = (taskId: string) => {
    if (!selectedBlock) return;
    const current = selectedBlock.taskIds ?? [];
    if (current.includes(taskId)) return;
    onUpdate(selectedBlock.id, { taskIds: [...current, taskId] });
  };

  const handleRemoveTaskFromBlock = (taskId: string) => {
    if (!selectedBlock) return;
    const current = selectedBlock.taskIds ?? [];
    onUpdate(selectedBlock.id, { taskIds: current.filter(id => id !== taskId) });
  };

  const handleAddNewTaskToBlock = async (name: string) => {
    if (!selectedBlock) return;
    const taskId = await onAddInboxTask(name);
    const current = selectedBlock.taskIds ?? [];
    onUpdate(selectedBlock.id, { taskIds: [...current, taskId] });
  };

  // Scroll to current hour on mount
  useEffect(() => {
    if (gridRef.current) {
      const now = new Date();
      const minutes = now.getHours() * 60 + now.getMinutes();
      gridRef.current.scrollTop = Math.max(0, minutes - 120);
    }
  }, []);

  // Update current-time indicator every minute
  useEffect(() => {
    const tick = () => {
      const n = new Date();
      setNowMinutes(n.getHours() * 60 + n.getMinutes());
    };
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
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
    const blockEl = (e.target as HTMLElement).closest<HTMLElement>('.agenda-block');
    if (blockEl) {
      const blockId = blockEl.dataset.blockId;
      if (!blockId) return;
      const block = workBlocks.find(b => b.id === blockId);
      if (!block) return;
      e.preventDefault();
      const minutes = getMinutesFromEvent(e);
      const offset = Math.max(0, minutes - block.startMinutes);
      setBlockDragState({
        blockId,
        originalDate: block.date,
        targetDate: date,
        offsetMinutes: offset,
        currentMinutes: block.startMinutes,
        duration: block.endMinutes - block.startMinutes,
        startClientY: e.clientY,
        hasMoved: false,
      });
      return;
    }
    e.preventDefault();
    const snapped = getMinutesFromEvent(e);
    setDragState({ date, startMinutes: snapped, currentMinutes: snapped });
  };

  const handleMouseMove = (date: string, e: React.MouseEvent<HTMLDivElement>) => {
    if (blockDragState) {
      const minutes = getMinutesFromEvent(e);
      const newStart = Math.max(0, Math.min(snap15(minutes - blockDragState.offsetMinutes), 1440 - blockDragState.duration));
      const moved = blockDragState.hasMoved || Math.abs(e.clientY - blockDragState.startClientY) > 8;
      if (moved) dragMovedRef.current = true;
      setBlockDragState(prev => prev ? { ...prev, currentMinutes: newStart, targetDate: date, hasMoved: moved } : null);
      return;
    }
    if (!dragState || dragState.date !== date) return;
    const snapped = getMinutesFromEvent(e);
    setDragState(prev => prev ? { ...prev, currentMinutes: snapped } : null);
  };

  const finishDrag = (date: string) => {
    if (blockDragState) {
      if (dragMovedRef.current) {
        onUpdate(blockDragState.blockId, {
          startMinutes: blockDragState.currentMinutes,
          endMinutes: blockDragState.currentMinutes + blockDragState.duration,
          date: blockDragState.targetDate,
        });
      }
      setBlockDragState(null);
      dragMovedRef.current = false;
      return;
    }
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

  const handleEventSave = async (data: Omit<CalendarEvent, 'id'>) => {
    if (editingEvent) {
      await onUpdateEvent(editingEvent.id, data);
      setEditingEvent(null);
    } else {
      await onAddEvent(data);
      setPendingSlot(null);
    }
  };

  const handleEventDelete = async () => {
    if (editingEvent) {
      await onDeleteEvent(editingEvent.id);
      setEditingEvent(null);
      setSelectedEventId(null);
    }
  };

  const hours = Array.from({ length: 24 }, (_, i) => i);

  return (
    <div className="agenda-view">
      {/* Left panel — only for manual blocks */}
      {isManual && selectedBlock && (
        <div className="agenda-left-panel">
          <div className="agenda-block-panel-header">
            <span className="agenda-block-panel-title">Wszystkie zadania</span>
          </div>
          <div className="agenda-left-panel-search">
            <input
              type="text"
              placeholder="Szukaj zadania..."
              value={leftPanelSearch}
              onChange={e => setLeftPanelSearch(e.target.value)}
            />
          </div>
          <div className="agenda-grouping-switcher">
            <button
              className={`agenda-grouping-btn${leftPanelGrouping === 'area' ? ' active' : ''}`}
              onClick={() => setLeftPanelGrouping('area')}
            >Obszar</button>
            <button
              className={`agenda-grouping-btn${leftPanelGrouping === 'context' ? ' active' : ''}`}
              onClick={() => setLeftPanelGrouping('context')}
            >Kontekst</button>
          </div>
          <div className="agenda-block-panel-body">
            {leftPanelGrouping === 'area' && (
              groupedTasks.length === 0
                ? <p className="agenda-block-panel-empty">Brak zadań</p>
                : groupedTasks.map(areaGroup => (
                    <div key={areaGroup.areaId ?? '__no_area__'} className="agenda-task-area-group">
                      <div className="agenda-task-area-header">{areaGroup.areaName}</div>
                      {areaGroup.lifters.map(lifterGroup => (
                        <div key={lifterGroup.lifterId ?? '__no_lifter__'} className="agenda-task-lifter-group">
                          <div className="agenda-task-lifter-header">{lifterGroup.lifterName}</div>
                          {lifterGroup.tasks.map(task => {
                            const project = projects.find(p => p.id === task.projectId);
                            return (
                              <div
                                key={task.id}
                                className="agenda-block-task-item agenda-left-task-item"
                                draggable
                                onDragStart={() => setTaskDragId(task.id)}
                                onDragEnd={() => setTaskDragId(null)}
                              >
                                <div className="agenda-block-task-info">
                                  <span className="agenda-block-task-name">{task.name}</span>
                                  {project && <span className="agenda-block-task-project">{project.name}</span>}
                                </div>
                                <button
                                  className="agenda-left-task-add-btn"
                                  onClick={() => handleAddTaskToBlock(task.id)}
                                  title="Dodaj do bloku"
                                >+</button>
                              </div>
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  ))
            )}
            {leftPanelGrouping === 'context' && (
              groupedByContext.length === 0
                ? <p className="agenda-block-panel-empty">Brak zadań</p>
                : groupedByContext.map(ctxGroup => (
                    <div key={ctxGroup.contextId ?? '__no_context__'} className="agenda-task-context-group">
                      <div className="agenda-task-context-header">
                        {ctxGroup.contextIcon && <span>{ctxGroup.contextIcon}</span>} {ctxGroup.contextName}
                      </div>
                      {ctxGroup.tasks.map(task => {
                        const project = projects.find(p => p.id === task.projectId);
                        return (
                          <div
                            key={task.id}
                            className="agenda-block-task-item agenda-left-task-item"
                            draggable
                            onDragStart={() => setTaskDragId(task.id)}
                            onDragEnd={() => setTaskDragId(null)}
                          >
                            <div className="agenda-block-task-info">
                              <span className="agenda-block-task-name">{task.name}</span>
                              {project && <span className="agenda-block-task-project">{project.name}</span>}
                            </div>
                            <button
                              className="agenda-left-task-add-btn"
                              onClick={() => handleAddTaskToBlock(task.id)}
                              title="Dodaj do bloku"
                            >+</button>
                          </div>
                        );
                      })}
                    </div>
                  ))
            )}
          </div>
        </div>
      )}

      <div className="agenda-main">
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

          {/* All-day events row */}
          <div className="agenda-allday-corner" />
          {visibleDates.map((d) => {
            const dayAllDayEvents = events.filter(e => isEventOnDate(e, d) && e.allDay);
            return (
              <div key={`allday-${d}`} className="agenda-allday-cell" onClick={() => setPendingAllDayDate(d)}>
                {dayAllDayEvents.map(event => (
                  <button
                    key={event.id}
                    className={`agenda-allday-chip${selectedEventId === event.id ? ' selected' : ''}`}
                    onClick={e => { e.stopPropagation(); setSelectedEventId(event.id); setSelectedBlockId(null); setSelectedTaskId(null); }}
                  >
                    ◈ {event.title}
                  </button>
                ))}
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
            const dayTimedEvents = events.filter(e => isEventOnDate(e, d) && !e.allDay);
            return (
              <div
                key={d}
                className="agenda-day-col"
                onMouseDown={(e) => handleMouseDown(d, e)}
                onMouseMove={(e) => handleMouseMove(d, e)}
                onMouseUp={() => finishDrag(d)}
              >
                {/* Hour lines + half-hour dashes */}
                {hours.map(h => (
                  <React.Fragment key={h}>
                    <div
                      className="agenda-hour-line"
                      style={{ top: `${h * 60}px` }}
                    />
                    <div
                      className="agenda-half-hour-line"
                      style={{ top: `${h * 60 + 30}px` }}
                    />
                  </React.Fragment>
                ))}

                {/* Current-time indicator */}
                {d === today && (
                  <div className="agenda-now-line" style={{ top: `${nowMinutes}px` }} />
                )}

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
                  const isDragging = blockDragState?.blockId === block.id && blockDragState!.hasMoved;
                  const isDraggingToThisCol = isDragging && blockDragState!.targetDate === d;
                  const isDraggingAway = isDragging && blockDragState!.targetDate !== d;
                  const top = isDraggingToThisCol ? blockDragState!.currentMinutes : block.startMinutes;
                  const height = Math.max(block.endMinutes - block.startMinutes, 20);
                  return (
                    <div
                      key={block.id}
                      data-block-id={block.id}
                      className={`agenda-block${selectedBlockId === block.id ? ' selected' : ''}${isDraggingToThisCol ? ' dragging' : ''}${isDraggingAway ? ' drag-ghost' : ''}`}
                      style={{
                        top: `${top}px`,
                        height: `${height}px`,
                        background: color + '33',
                        borderLeft: `3px solid ${color}`,
                      }}
                      onClick={e => {
                        e.stopPropagation();
                        if (dragMovedRef.current) { dragMovedRef.current = false; return; }
                        setSelectedBlockId(block.id);
                        setSelectedEventId(null);
                      }}
                    >
                      <span className="agenda-block-title">{block.title}</span>
                      <span className="agenda-block-time">
                        {isDraggingToThisCol
                          ? `${formatTime(blockDragState!.currentMinutes)}–${formatTime(blockDragState!.currentMinutes + blockDragState!.duration)}`
                          : `${formatTime(block.startMinutes)}–${formatTime(block.endMinutes)}`}
                      </span>
                    </div>
                  );
                })}

                {/* Dragged block preview when moved from another day */}
                {blockDragState?.targetDate === d && blockDragState.originalDate !== d && blockDragState.hasMoved && (() => {
                  const block = workBlocks.find(b => b.id === blockDragState.blockId);
                  if (!block) return null;
                  const color = getBlockColor(block, areas);
                  const height = Math.max(blockDragState.duration, 20);
                  return (
                    <div
                      key="block-drag-preview"
                      className="agenda-block dragging"
                      style={{
                        top: `${blockDragState.currentMinutes}px`,
                        height: `${height}px`,
                        background: color + '33',
                        borderLeft: `3px solid ${color}`,
                      }}
                    >
                      <span className="agenda-block-title">{block.title}</span>
                      <span className="agenda-block-time">
                        {formatTime(blockDragState.currentMinutes)}–{formatTime(blockDragState.currentMinutes + blockDragState.duration)}
                      </span>
                    </div>
                  );
                })()}

                {/* Timed events */}
                {dayTimedEvents.map(event => {
                  const start = event.startMinutes ?? 0;
                  const end = event.endMinutes ?? start + 60;
                  const height = Math.max(end - start, 20);
                  return (
                    <div
                      key={event.id}
                      className={`agenda-block agenda-event${selectedEventId === event.id ? ' selected' : ''}`}
                      style={{
                        top: `${start}px`,
                        height: `${height}px`,
                        background: EVENT_COLOR + '22',
                        borderLeft: `3px solid ${EVENT_COLOR}`,
                      }}
                      onClick={e => {
                        e.stopPropagation();
                        setSelectedEventId(event.id);
                        setSelectedBlockId(null);
                        setSelectedTaskId(null);
                      }}
                    >
                      <span className="agenda-block-title">◈ {event.title}</span>
                      {height >= 35 && (
                        <span className="agenda-block-time">
                          {formatTime(start)}–{formatTime(end)}
                        </span>
                      )}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>

      </div>{/* end .agenda-main */}

      {selectedBlock && (
        <div
          className={`agenda-block-panel${dropTargetActive ? ' drop-target-active' : ''}`}
          onDragOver={isManual ? (e) => { e.preventDefault(); setDropTargetActive(true); } : undefined}
          onDragLeave={isManual ? (e) => {
            if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTargetActive(false);
          } : undefined}
          onDrop={isManual ? (e) => {
            e.preventDefault();
            setDropTargetActive(false);
            if (taskDragId) { handleAddTaskToBlock(taskDragId); setTaskDragId(null); }
          } : undefined}
        >
          <div className="agenda-block-panel-header">
            <div className="agenda-block-panel-header-top">
              <span className="agenda-block-panel-title">{selectedBlock.title}</span>
              <button className="agenda-block-panel-close" onClick={() => { setSelectedBlockId(null); setSelectedTaskId(null); }}>✕</button>
            </div>
            <div className="agenda-block-panel-actions">
              <button onClick={() => onDuplicate(selectedBlock.id)}>Duplikuj</button>
              <button onClick={() => setEditingBlock(selectedBlock)}>Edytuj blok</button>
            </div>
          </div>
          {isManual && (
            <div className="agenda-block-add-task">
              <input
                type="text"
                placeholder="Dodaj zadanie do bloku..."
                value={newBlockTaskName}
                onChange={e => setNewBlockTaskName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter' && newBlockTaskName.trim()) {
                    handleAddNewTaskToBlock(newBlockTaskName.trim());
                    setNewBlockTaskName('');
                  }
                }}
              />
            </div>
          )}
          <div className="agenda-block-panel-body">
            {pinnedDurationOverflow && (
              <div className="block-duration-warning">
                ⚠ Suma czasów zadań ({pinnedTasksTotalDuration >= 60 ? `${Math.floor(pinnedTasksTotalDuration / 60)}h${pinnedTasksTotalDuration % 60 > 0 ? ` ${pinnedTasksTotalDuration % 60}m` : ''}` : `${pinnedTasksTotalDuration}m`}) przekracza długość bloku ({selectedBlockDuration}m)
              </div>
            )}
            {isManual ? (
              <>
                {pinnedUndoneTasks.length === 0 && pinnedDoneTasks.length === 0
                  ? <p className="agenda-block-panel-empty">Przeciągnij zadania z lewego panelu lub wpisz nowe powyżej.</p>
                  : pinnedUndoneTasks.map(task => {
                      const project = projects.find(p => p.id === task.projectId);
                      return (
                        <div
                          key={task.id}
                          className={`agenda-block-task-item${selectedTaskId === task.id ? ' selected' : ''}`}
                          onClick={() => setSelectedTaskId(prev => prev === task.id ? null : task.id)}
                        >
                          <input
                            type="checkbox"
                            checked={task.done}
                            onChange={e => { e.stopPropagation(); onUpdateTask(task.id, { done: !task.done }); }}
                            onClick={e => e.stopPropagation()}
                          />
                          <div className="agenda-block-task-info">
                            <span className="agenda-block-task-name">{task.name}</span>
                            {project && <span className="agenda-block-task-project">{project.name}</span>}
                          </div>
                          <button
                            className="agenda-right-task-remove-btn"
                            onClick={e => { e.stopPropagation(); handleRemoveTaskFromBlock(task.id); }}
                            title="Usuń z bloku"
                          >✕</button>
                        </div>
                      );
                    })
                }
                {pinnedDoneTasks.length > 0 && (
                  <div className="block-done-section">
                    <button className="block-done-toggle" onClick={() => setShowBlockDone(v => !v)}>
                      {showBlockDone ? '▾' : '▸'} Ukończone ({pinnedDoneTasks.length})
                    </button>
                    {showBlockDone && pinnedDoneTasks.map(task => {
                      const project = projects.find(p => p.id === task.projectId);
                      return (
                        <div
                          key={task.id}
                          className={`agenda-block-task-item done${selectedTaskId === task.id ? ' selected' : ''}`}
                          onClick={() => setSelectedTaskId(prev => prev === task.id ? null : task.id)}
                        >
                          <input
                            type="checkbox"
                            checked={true}
                            onChange={e => { e.stopPropagation(); onUpdateTask(task.id, { done: false }); }}
                            onClick={e => e.stopPropagation()}
                          />
                          <div className="agenda-block-task-info">
                            <span className="agenda-block-task-name">{task.name}</span>
                            {project && <span className="agenda-block-task-project">{project.name}</span>}
                          </div>
                          <button
                            className="agenda-right-task-remove-btn"
                            onClick={e => { e.stopPropagation(); handleRemoveTaskFromBlock(task.id); }}
                            title="Usuń z bloku"
                          >✕</button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            ) : (
              <>
                {matchingTasks.length === 0 && matchingDoneTasks.length === 0
                  ? <p className="agenda-block-panel-empty">Brak zadań pasujących do filtrów bloku.</p>
                  : matchingTasks.map(task => {
                      const project = projects.find(p => p.id === task.projectId);
                      return (
                        <div
                          key={task.id}
                          className={`agenda-block-task-item${selectedTaskId === task.id ? ' selected' : ''}`}
                          onClick={() => setSelectedTaskId(prev => prev === task.id ? null : task.id)}
                        >
                          <input
                            type="checkbox"
                            checked={task.done}
                            onChange={e => { e.stopPropagation(); onUpdateTask(task.id, { done: !task.done }); }}
                            onClick={e => e.stopPropagation()}
                          />
                          <div className="agenda-block-task-info">
                            <span className="agenda-block-task-name">{task.name}</span>
                            {project && <span className="agenda-block-task-project">{project.name}</span>}
                          </div>
                        </div>
                      );
                    })
                }
                {matchingDoneTasks.length > 0 && (
                  <div className="block-done-section">
                    <button className="block-done-toggle" onClick={() => setShowBlockDone(v => !v)}>
                      {showBlockDone ? '▾' : '▸'} Ukończone ({matchingDoneTasks.length})
                    </button>
                    {showBlockDone && matchingDoneTasks.map(task => {
                      const project = projects.find(p => p.id === task.projectId);
                      return (
                        <div
                          key={task.id}
                          className={`agenda-block-task-item done${selectedTaskId === task.id ? ' selected' : ''}`}
                          onClick={() => setSelectedTaskId(prev => prev === task.id ? null : task.id)}
                        >
                          <input
                            type="checkbox"
                            checked={true}
                            onChange={e => { e.stopPropagation(); onUpdateTask(task.id, { done: false }); }}
                            onClick={e => e.stopPropagation()}
                          />
                          <div className="agenda-block-task-info">
                            <span className="agenda-block-task-name">{task.name}</span>
                            {project && <span className="agenda-block-task-project">{project.name}</span>}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      )}

      {selectedEventId && (() => {
        const event = events.find(e => e.id === selectedEventId);
        return event ? (
          <div className="agenda-block-panel">
            <div className="agenda-block-panel-header">
              <span className="agenda-block-panel-title">◈ {event.title}</span>
              <div className="agenda-block-panel-actions">
                <button onClick={() => setEditingEvent(event)}>Edytuj</button>
                <button onClick={() => setSelectedEventId(null)}>✕</button>
              </div>
            </div>
            <div className="agenda-block-panel-body" style={{ padding: 0 }}>
              <EventDetailPanel
                event={event}
                tasks={tasks}
                projects={projects}
                onUpdate={updates => onUpdateEvent(event.id, updates)}
                onDelete={async () => { await onDeleteEvent(event.id); setSelectedEventId(null); }}
                onAddTask={name => onAddEventTask(event.id, name)}
                onUpdateTask={onUpdateTask}
              />
            </div>
          </div>
        ) : null;
      })()}

      {selectedTaskId && (() => {
        const task = tasks.find(t => t.id === selectedTaskId);
        return task ? (
          <TaskDetailPanel
            task={task}
            contexts={contexts}
            onUpdate={(key, value) => onUpdateTask(task.id, { [key]: value })}
            onDelete={() => { onDeleteTask(task.id); setSelectedTaskId(null); }}
            onClose={() => setSelectedTaskId(null)}
            onCompleteWithNextAction={name => onCompleteWithNextAction(task, name)}
          />
        ) : null;
      })()}

      {/* Modal: create all-day event (click on all-day row) */}
      {pendingAllDayDate && (
        <EventModal
          event={{ date: pendingAllDayDate, allDay: true }}
          defaultDate={pendingAllDayDate}
          defaultStartMinutes={9 * 60}
          projects={projects}
          onSave={data => { onAddEvent(data); setPendingAllDayDate(null); }}
          onClose={() => setPendingAllDayDate(null)}
        />
      )}

      {/* Modal: create block or event */}
      {pendingSlot && !editingBlock && !editingEvent && (
        <CreateSlotModal
          defaultDate={pendingSlot.date}
          defaultStartMinutes={pendingSlot.startMinutes}
          defaultEndMinutes={pendingSlot.endMinutes}
          areas={areas}
          lifters={lifters}
          projects={projects}
          contexts={contexts}
          blockTemplates={blockTemplates}
          onSaveBlock={handleSave}
          onSaveEvent={data => { onAddEvent(data); setPendingSlot(null); }}
          onClose={() => setPendingSlot(null)}
        />
      )}

      {/* Modal: edit block */}
      {editingBlock && (
        <WorkBlockModal
          block={editingBlock}
          defaultDate={editingBlock.date}
          defaultStartMinutes={editingBlock.startMinutes}
          areas={areas}
          lifters={lifters}
          projects={projects}
          contexts={contexts}
          blockTemplates={blockTemplates}
          onSave={handleSave}
          onDelete={handleDelete}
          onClose={() => setEditingBlock(null)}
        />
      )}

      {/* Modal: edit event */}
      {editingEvent && (
        <EventModal
          event={editingEvent}
          defaultDate={editingEvent.date}
          defaultStartMinutes={editingEvent.startMinutes ?? 9 * 60}
          defaultEndMinutes={editingEvent.endMinutes}
          projects={projects}
          onSave={handleEventSave}
          onDelete={handleEventDelete}
          onClose={() => setEditingEvent(null)}
        />
      )}
    </div>
  );
}
