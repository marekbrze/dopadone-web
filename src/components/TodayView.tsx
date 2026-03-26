import { useState, useEffect, useRef } from 'react';
import React from 'react';
import type { Area, Lifter, Project, Task, Context, WorkBlock, CalendarEvent, BlockTemplate, ProjectNote } from '../types';
import { EventDetailPanel } from './EventDetailPanel';
import { ActiveEventPanel } from './ActiveEventPanel';
import { CreateSlotModal } from './CreateSlotModal';

interface Props {
  areas: Area[];
  lifters: Lifter[];
  projects: Project[];
  tasks: Task[];
  contexts: Context[];
  workBlocks: WorkBlock[];
  events: CalendarEvent[];
  onUpdateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  onAddEvent: (data: Omit<CalendarEvent, 'id'>) => Promise<CalendarEvent>;
  onUpdateEvent: (id: string, updates: Partial<CalendarEvent>) => Promise<void>;
  onDeleteEvent: (id: string) => Promise<void>;
  onAddEventTask: (eventId: string, name: string) => Promise<void>;
  onAddWorkBlock: (data: Omit<WorkBlock, 'id'>) => void;
  onUpdateWorkBlock: (id: string, updates: Partial<WorkBlock>) => void;
  onDuplicateWorkBlock: (id: string) => void;
  blockTemplates?: BlockTemplate[];
  notes: ProjectNote[];
  onAddNote: (projectId: string, data: { title?: string; content: string }) => Promise<void>;
  onUpdateNote: (id: string, updates: Partial<ProjectNote>) => Promise<void>;
  onDeleteNote: (id: string) => Promise<void>;
}

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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

function getBlockColor(block: WorkBlock, areas: Area[]): string {
  if (block.color) return block.color;
  const area = areas.find(a => a.id === block.areaIds[0]);
  return area?.color ?? '#5c4a38';
}

function getMatchingTasks(block: WorkBlock, tasks: Task[], projects: Project[]): Task[] {
  if (block.blockType === 'manual') {
    return (block.taskIds ?? [])
      .map(id => tasks.find(t => t.id === id))
      .filter((t): t is Task => t !== undefined);
  }
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
  if (block.blockType === 'manual') {
    return (block.taskIds ?? [])
      .map(id => tasks.find(t => t.id === id))
      .filter((t): t is Task => t !== undefined && t.done);
  }
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

function isEventOnDate(event: CalendarEvent, dateStr: string): boolean {
  if (event.date === dateStr) return true;
  if (event.endDate && event.date <= dateStr && dateStr <= event.endDate) return true;
  return false;
}

const priorityColors: Record<Task['priority'], string> = {
  low: '#5a7a5e',
  medium: '#a07830',
  high: '#a33a2a',
};

const EVENT_COLOR = '#b8542a';

const hours = Array.from({ length: 24 }, (_, i) => i);

function snap15(minutes: number): number {
  return Math.round(minutes / 15) * 15;
}

export function TodayView({ areas, lifters, projects, tasks, contexts, workBlocks, events, onUpdateTask, onAddEvent, onUpdateEvent, onDeleteEvent, onAddEventTask, onAddWorkBlock, onUpdateWorkBlock, onDuplicateWorkBlock, blockTemplates = [], notes, onAddNote, onUpdateNote, onDeleteNote }: Props) {
  const [now, setNow] = useState(() => new Date());
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [showBlockDone, setShowBlockDone] = useState(false);
  type TaskGrouping = 'none' | 'area' | 'context';
  const [taskGrouping, setTaskGrouping] = useState<TaskGrouping>(() => {
    const saved = localStorage.getItem('dopadone-today-grouping');
    return (saved === 'none' || saved === 'area' || saved === 'context') ? saved : 'area';
  });
  const setAndSaveGrouping = (g: TaskGrouping) => {
    setTaskGrouping(g);
    localStorage.setItem('dopadone-today-grouping', g);
  };
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [dragState, setDragState] = useState<{ startMinutes: number; currentMinutes: number } | null>(null);
  const [blockDragState, setBlockDragState] = useState<{
    blockId: string;
    offsetMinutes: number;
    currentMinutes: number;
    duration: number;
    startClientY: number;
    hasMoved: boolean;
  } | null>(null);
  const dragMovedRef = useRef(false);
  const [pendingSlot, setPendingSlot] = useState<{ startMinutes: number; endMinutes: number } | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1_000);
    return () => clearInterval(id);
  }, []);

  // Scroll timeline to current hour on mount
  useEffect(() => {
    if (timelineRef.current) {
      const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
      timelineRef.current.scrollTop = Math.max(0, nowMin - 120);
    }
  }, []);

  useEffect(() => {
    const handleGlobalMouseUp = () => {
      if (blockDragState) {
        if (dragMovedRef.current) {
          onUpdateWorkBlock(blockDragState.blockId, {
            startMinutes: blockDragState.currentMinutes,
            endMinutes: blockDragState.currentMinutes + blockDragState.duration,
          });
        }
        setBlockDragState(null);
        dragMovedRef.current = false;
        return;
      }
      if (dragState) {
        const startMin = Math.min(dragState.startMinutes, dragState.currentMinutes);
        const endMin = Math.max(dragState.startMinutes, dragState.currentMinutes);
        const finalEnd = endMin - startMin < 15 ? startMin + 60 : endMin;
        setPendingSlot({ startMinutes: startMin, endMinutes: finalEnd });
        setDragState(null);
      }
    };
    document.addEventListener('mouseup', handleGlobalMouseUp);
    return () => document.removeEventListener('mouseup', handleGlobalMouseUp);
  }, [dragState, blockDragState]);

  const todayStr = toDateString(now);
  const todayBlocks = workBlocks
    .filter(b => b.date === todayStr)
    .sort((a, b) => a.startMinutes - b.startMinutes);

  const todayEvents = events.filter(e => isEventOnDate(e, todayStr));
  const allDayEvents = todayEvents.filter(e => e.allDay);
  const timedEvents = todayEvents
    .filter(e => !e.allDay)
    .sort((a, b) => (a.startMinutes ?? 0) - (b.startMinutes ?? 0));

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const currentBlock = todayBlocks.find(
    b => b.startMinutes <= nowMinutes && nowMinutes < b.endMinutes
  ) ?? null;

  const currentEvent = timedEvents.find(
    e => (e.startMinutes ?? 0) <= nowMinutes && nowMinutes < (e.endMinutes ?? 0)
  ) ?? null;

  useEffect(() => {
    if (selectedBlockId && !todayBlocks.find(b => b.id === selectedBlockId)) {
      setSelectedBlockId(null);
    }
  }, [workBlocks]);

  useEffect(() => { setShowBlockDone(false); }, [selectedBlockId]);

  useEffect(() => {
    if (selectedEventId && !todayEvents.find(e => e.id === selectedEventId)) {
      setSelectedEventId(null);
    }
  }, [events]);

  const displayBlock = selectedBlockId
    ? (todayBlocks.find(b => b.id === selectedBlockId) ?? currentBlock)
    : currentBlock;

  const handleRemoveTaskFromBlock = (taskId: string) => {
    if (!displayBlock || displayBlock.blockType !== 'manual') return;
    const current = displayBlock.taskIds ?? [];
    onUpdateWorkBlock(displayBlock.id, { taskIds: current.filter(id => id !== taskId) });
  };

  const selectedEvent = selectedEventId ? events.find(e => e.id === selectedEventId) ?? null : null;

  const blockTasks = displayBlock
    ? getMatchingTasks(displayBlock, tasks, projects)
    : [];

  const blockUndoneTasks = blockTasks.filter(t => !t.done);
  const blockDoneTasks = displayBlock
    ? getMatchingDoneTasks(displayBlock, tasks, projects)
    : [];

  const blockTasksTotalDuration = blockTasks.reduce((sum, t) => sum + (t.duration ?? 0), 0);
  const displayBlockDuration = displayBlock ? displayBlock.endMinutes - displayBlock.startMinutes : 0;
  const blockDurationOverflow = blockTasksTotalDuration > 0 && blockTasksTotalDuration > displayBlockDuration;

  const isCurrentlyActive = displayBlock?.id === currentBlock?.id;
  const nowSeconds = now.getHours() * 3600 + now.getMinutes() * 60 + now.getSeconds();
  const remainingSeconds = isCurrentlyActive && displayBlock
    ? Math.max(0, displayBlock.endMinutes * 60 - nowSeconds)
    : 0;
  const blockDurationSeconds = displayBlock
    ? (displayBlock.endMinutes - displayBlock.startMinutes) * 60
    : 1;
  const remainingPct = remainingSeconds / blockDurationSeconds;

  type LifterGroup = { lifterId: string | null; lifterName: string; lifterOrder: number; tasks: Task[] };
  type AreaGroup = { areaId: string | null; areaName: string; areaOrder: number; lifters: LifterGroup[] };

  const blockGroupedByArea: AreaGroup[] = React.useMemo(() => {
    if (!displayBlock) return [];
    const areaMap = new Map<string, AreaGroup>();
    for (const task of blockUndoneTasks) {
      const project = projects.find(p => p.id === task.projectId);
      const areaId = project?.areaId ?? null;
      const lifterId = project?.lifterId ?? null;
      const area = areas.find(a => a.id === areaId);
      const lifter = lifters.find(l => l.id === lifterId);
      const areaKey = areaId ?? '__no_area__';
      if (!areaMap.has(areaKey)) {
        areaMap.set(areaKey, { areaId, areaName: area?.name ?? 'Bez obszaru', areaOrder: (area as any)?.order ?? 999, lifters: [] });
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
  }, [blockUndoneTasks, projects, areas, lifters, displayBlock]);

  type ContextGroup = { contextId: string | null; contextName: string; contextIcon: string; tasks: Task[] };

  const blockGroupedByContext: ContextGroup[] = React.useMemo(() => {
    if (!displayBlock) return [];
    const contextMap = new Map<string, ContextGroup>();
    for (const task of blockUndoneTasks) {
      const contextId = task.contextId ?? null;
      const context = contexts.find(c => c.id === contextId);
      const key = contextId ?? '__no_context__';
      if (!contextMap.has(key)) {
        contextMap.set(key, { contextId, contextName: context?.name ?? 'Bez kontekstu', contextIcon: context?.icon ?? '', tasks: [] });
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
  }, [blockUndoneTasks, contexts, displayBlock]);

  const eventNotes = React.useMemo(
    () => notes.filter(n => n.projectId === currentEvent?.projectId),
    [notes, currentEvent?.projectId]
  );

  const dateLabel = now.toLocaleDateString('pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');

  const nextBlock = currentBlock === null
    ? todayBlocks.find(b => b.startMinutes > nowMinutes)
    : null;

  const handleBlockClick = (blockId: string) => {
    setSelectedBlockId(prev => prev === blockId ? null : blockId);
    setSelectedEventId(null);
  };

  const handleEventClick = (eventId: string) => {
    setSelectedEventId(prev => prev === eventId ? null : eventId);
    setSelectedBlockId(null);
  };

  const getMinutesFromEvent = (e: React.MouseEvent<HTMLDivElement>): number => {
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    return Math.max(0, Math.min(snap15(y), 24 * 60 - 15));
  };

  return (
    <>
      <div className="today-view">
        <div className="today-header">
          <div className="today-header-left">
            <div className="today-date-line">{dateLabel}</div>
            <div className="today-clock">
              <span className="today-clock-hm">{hh}:{mm}</span>
              <span className="today-clock-sep">:</span>
              <span className="today-clock-ss">{ss}</span>
            </div>
          </div>
          <div className="today-header-rule" />
        </div>

        <div className="today-body">
          {/* LEFT: day timeline */}
          <aside className="today-agenda">
            <div className="today-agenda-heading">
              Harmonogram dnia
            </div>

            {/* All-day events strip */}
            {allDayEvents.length > 0 && (
              <div className="today-allday-strip">
                {allDayEvents.map(event => (
                  <button
                    key={event.id}
                    className={`today-allday-chip${selectedEventId === event.id ? ' selected' : ''}`}
                    onClick={() => handleEventClick(event.id)}
                  >
                    ◈ {event.title}
                  </button>
                ))}
              </div>
            )}

            <div className="today-timeline-wrap" ref={timelineRef}>
              <div className="today-timeline">
                {/* Time axis */}
                <div className="today-time-axis">
                  {hours.map(h => (
                    <div
                      key={h}
                      className="agenda-hour-label"
                      style={{ top: `${h * 60}px` }}
                    >
                      {h.toString().padStart(2, '0')}:00
                    </div>
                  ))}
                </div>

                {/* Day column */}
                <div
                  className="today-day-col"
                  onMouseDown={e => {
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
                    setDragState({ startMinutes: snapped, currentMinutes: snapped });
                  }}
                  onMouseMove={e => {
                    if (blockDragState) {
                      const minutes = getMinutesFromEvent(e);
                      const newStart = Math.max(0, Math.min(snap15(minutes - blockDragState.offsetMinutes), 1440 - blockDragState.duration));
                      const moved = blockDragState.hasMoved || Math.abs(e.clientY - blockDragState.startClientY) > 8;
                      if (moved) dragMovedRef.current = true;
                      setBlockDragState(prev => prev ? { ...prev, currentMinutes: newStart, hasMoved: moved } : null);
                      return;
                    }
                    if (!dragState) return;
                    const snapped = getMinutesFromEvent(e);
                    setDragState(prev => prev ? { ...prev, currentMinutes: snapped } : null);
                  }}
                  onMouseUp={() => {
                    if (blockDragState) return; // handled by global mouseup
                    if (!dragState) return;
                    const startMin = Math.min(dragState.startMinutes, dragState.currentMinutes);
                    const endMin = Math.max(dragState.startMinutes, dragState.currentMinutes);
                    const finalEnd = endMin - startMin < 15 ? startMin + 60 : endMin;
                    setPendingSlot({ startMinutes: startMin, endMinutes: finalEnd });
                    setDragState(null);
                  }}
                >
                  {/* Hour lines */}
                  {hours.map(h => (
                    <React.Fragment key={h}>
                      <div className="agenda-hour-line" style={{ top: `${h * 60}px` }} />
                      <div className="agenda-half-hour-line" style={{ top: `${h * 60 + 30}px` }} />
                    </React.Fragment>
                  ))}

                  {/* Current-time indicator */}
                  <div className="agenda-now-line" style={{ top: `${nowMinutes}px` }} />

                  {/* Drag preview */}
                  {dragState && dragState.startMinutes !== dragState.currentMinutes && (
                    <div
                      className="agenda-drag-preview"
                      style={{
                        top: `${Math.min(dragState.startMinutes, dragState.currentMinutes)}px`,
                        height: `${Math.abs(dragState.currentMinutes - dragState.startMinutes)}px`,
                      }}
                    />
                  )}

                  {/* Work blocks */}
                  {todayBlocks.map(block => {
                    const color = getBlockColor(block, areas);
                    const isDragging = blockDragState?.blockId === block.id && blockDragState!.hasMoved;
                    const top = isDragging ? blockDragState!.currentMinutes : block.startMinutes;
                    const height = Math.max(block.endMinutes - block.startMinutes, 20);
                    const isSelected = block.id === (selectedBlockId ?? currentBlock?.id);
                    return (
                      <div
                        key={block.id}
                        data-block-id={block.id}
                        className={`agenda-block${isSelected ? ' selected' : ''}${isDragging ? ' dragging' : ''}`}
                        style={{
                          top: `${top}px`,
                          height: `${height}px`,
                          background: color + '33',
                          borderLeft: `3px solid ${color}`,
                        }}
                        onClick={() => {
                          if (dragMovedRef.current) { dragMovedRef.current = false; return; }
                          handleBlockClick(block.id);
                        }}
                      >
                        <span className="agenda-block-title">{block.title}</span>
                        <span className="agenda-block-time">
                          {isDragging
                            ? `${formatTime(blockDragState!.currentMinutes)}–${formatTime(blockDragState!.currentMinutes + blockDragState!.duration)}`
                            : `${formatTime(block.startMinutes)}–${formatTime(block.endMinutes)}`}
                        </span>
                      </div>
                    );
                  })}

                  {/* Timed events */}
                  {timedEvents.map(event => {
                    const start = event.startMinutes ?? 0;
                    const end = event.endMinutes ?? start + 60;
                    const height = Math.max(end - start, 20);
                    const isSelected = selectedEventId === event.id;
                    return (
                      <div
                        key={event.id}
                        className={`agenda-block agenda-event${isSelected ? ' selected' : ''}`}
                        style={{
                          top: `${start}px`,
                          height: `${height}px`,
                          background: EVENT_COLOR + '22',
                          borderLeft: `3px solid ${EVENT_COLOR}`,
                        }}
                        onClick={() => handleEventClick(event.id)}
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
              </div>
            </div>
          </aside>

          {/* RIGHT: active block panel OR event detail */}
          <section className="today-active-panel">
            {selectedEvent ? (
              <EventDetailPanel
                event={selectedEvent}
                tasks={tasks}
                projects={projects}
                onUpdate={updates => onUpdateEvent(selectedEvent.id, updates)}
                onDelete={async () => { await onDeleteEvent(selectedEvent.id); setSelectedEventId(null); }}
                onAddTask={name => onAddEventTask(selectedEvent.id, name)}
                onUpdateTask={onUpdateTask}
              />
            ) : currentEvent && !selectedEventId && !selectedBlockId ? (
              <ActiveEventPanel
                event={currentEvent}
                tasks={tasks}
                projects={projects}
                notes={eventNotes}
                now={now}
                onUpdateTask={onUpdateTask}
                onAddTask={name => onAddEventTask(currentEvent.id, name)}
                onAddNote={currentEvent.projectId
                  ? data => onAddNote(currentEvent.projectId!, data)
                  : async () => {}}
                onUpdateNote={onUpdateNote}
                onDeleteNote={onDeleteNote}
              />
            ) : displayBlock ? (
              <>
                <div
                  className="today-active-header"
                  style={{ borderTopColor: getBlockColor(displayBlock, areas) }}
                >
                  <div className="today-active-meta">
                    <span className="today-active-time">
                      {formatTime(displayBlock.startMinutes)} – {formatTime(displayBlock.endMinutes)}
                    </span>
                    {displayBlock.id === currentBlock?.id && (
                      <span className="today-active-live-dot" />
                    )}
                    {isCurrentlyActive && (
                      <span
                        className="today-block-countdown"
                        style={{ color: getCountdownColor(remainingPct) }}
                      >
                        {formatCountdown(remainingSeconds)}
                      </span>
                    )}
                  </div>
                  <div className="today-active-title-row">
                    <div className="today-active-title">{displayBlock.title}</div>
                    <div className="today-block-header-actions">
                      <select
                        className="today-grouping-select"
                        value={taskGrouping}
                        onChange={e => setAndSaveGrouping(e.target.value as TaskGrouping)}
                      >
                        <option value="none">Brak grupowania</option>
                        <option value="area">Obszar</option>
                        <option value="context">Kontekst</option>
                      </select>
                      <button
                        className="today-block-duplicate-btn"
                        onClick={() => onDuplicateWorkBlock(displayBlock.id)}
                        title="Duplikuj blok"
                      >Duplikuj</button>
                    </div>
                  </div>
                </div>
                <div className="today-active-tasks">
                  {blockUndoneTasks.length === 0 && blockDoneTasks.length === 0 ? (
                    <div className="today-active-empty">
                      Brak zadań przypisanych do tego bloku.
                    </div>
                  ) : (
                    <>
                      <div className="today-tasks-section-label">
                        Zadania
                        <span className="today-tasks-count">
                          {blockDoneTasks.length}/{blockUndoneTasks.length + blockDoneTasks.length}
                        </span>
                      </div>
                      {blockDurationOverflow && (
                        <div className="block-duration-warning">
                          ⚠ Suma czasów ({blockTasksTotalDuration >= 60 ? `${Math.floor(blockTasksTotalDuration / 60)}h${blockTasksTotalDuration % 60 > 0 ? ` ${blockTasksTotalDuration % 60}m` : ''}` : `${blockTasksTotalDuration}m`}) przekracza blok ({displayBlockDuration}m)
                        </div>
                      )}
{taskGrouping === 'none' && blockUndoneTasks.map(task => (
                        <div
                          key={task.id}
                          className="today-task-item"
                        >
                          <input
                            type="checkbox"
                            checked={false}
                            onChange={() => onUpdateTask(task.id, { done: true })}
                            id={`today-task-${task.id}`}
                          />
                          <label
                            className="today-task-name"
                            htmlFor={`today-task-${task.id}`}
                          >
                            {task.name}
                          </label>
                          <span
                            className="today-priority-dot"
                            style={{ background: priorityColors[task.priority] }}
                            title={task.priority}
                          />
                          {displayBlock.blockType === 'manual' && (
                            <button
                              className="today-task-remove-btn"
                              onClick={() => handleRemoveTaskFromBlock(task.id)}
                              title="Usuń z bloku"
                            >✕</button>
                          )}
                        </div>
                      ))}
                      {taskGrouping === 'area' && blockGroupedByArea.map(areaGroup => (
                        <div key={areaGroup.areaId ?? '__no_area__'} className="agenda-task-area-group">
                          <div className="agenda-task-area-header">{areaGroup.areaName}</div>
                          {areaGroup.lifters.map(lifterGroup => (
                            <div key={lifterGroup.lifterId ?? '__no_lifter__'} className="agenda-task-lifter-group">
                              <div className="agenda-task-lifter-header">{lifterGroup.lifterName}</div>
                              {lifterGroup.tasks.map(task => (
                                <div key={task.id} className="today-task-item">
                                  <input
                                    type="checkbox"
                                    checked={false}
                                    onChange={() => onUpdateTask(task.id, { done: true })}
                                    id={`today-task-${task.id}`}
                                  />
                                  <label className="today-task-name" htmlFor={`today-task-${task.id}`}>
                                    {task.name}
                                  </label>
                                  <span
                                    className="today-priority-dot"
                                    style={{ background: priorityColors[task.priority] }}
                                    title={task.priority}
                                  />
                                  {displayBlock.blockType === 'manual' && (
                                    <button
                                      className="today-task-remove-btn"
                                      onClick={() => handleRemoveTaskFromBlock(task.id)}
                                      title="Usuń z bloku"
                                    >✕</button>
                                  )}
                                </div>
                              ))}
                            </div>
                          ))}
                        </div>
                      ))}
                      {taskGrouping === 'context' && blockGroupedByContext.map(ctxGroup => (
                        <div key={ctxGroup.contextId ?? '__no_context__'} className="agenda-task-context-group">
                          <div className="agenda-task-context-header">
                            {ctxGroup.contextIcon && <span>{ctxGroup.contextIcon}</span>} {ctxGroup.contextName}
                          </div>
                          {ctxGroup.tasks.map(task => (
                            <div key={task.id} className="today-task-item">
                              <input
                                type="checkbox"
                                checked={false}
                                onChange={() => onUpdateTask(task.id, { done: true })}
                                id={`today-task-${task.id}`}
                              />
                              <label className="today-task-name" htmlFor={`today-task-${task.id}`}>
                                {task.name}
                              </label>
                              <span
                                className="today-priority-dot"
                                style={{ background: priorityColors[task.priority] }}
                                title={task.priority}
                              />
                              {displayBlock.blockType === 'manual' && (
                                <button
                                  className="today-task-remove-btn"
                                  onClick={() => handleRemoveTaskFromBlock(task.id)}
                                  title="Usuń z bloku"
                                >✕</button>
                              )}
                            </div>
                          ))}
                        </div>
                      ))}
                      {blockDoneTasks.length > 0 && (
                        <div className="block-done-section">
                          <button className="block-done-toggle" onClick={() => setShowBlockDone(v => !v)}>
                            {showBlockDone ? '▾' : '▸'} Ukończone ({blockDoneTasks.length})
                          </button>
                          {showBlockDone && blockDoneTasks.map(task => (
                            <div
                              key={task.id}
                              className="today-task-item done"
                            >
                              <input
                                type="checkbox"
                                checked={true}
                                onChange={() => onUpdateTask(task.id, { done: false })}
                                id={`today-task-done-${task.id}`}
                              />
                              <label
                                className="today-task-name"
                                htmlFor={`today-task-done-${task.id}`}
                              >
                                {task.name}
                              </label>
                              <span
                                className="today-priority-dot"
                                style={{ background: priorityColors[task.priority] }}
                                title={task.priority}
                              />
                              {displayBlock.blockType === 'manual' && (
                                <button
                                  className="today-task-remove-btn"
                                  onClick={() => handleRemoveTaskFromBlock(task.id)}
                                  title="Usuń z bloku"
                                >✕</button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                </div>
              </>
            ) : (
              <div className="today-active-empty-state">
                <div className="today-active-empty-icon">◎</div>
                <div className="today-active-empty-msg">
                  {todayBlocks.length > 0
                    ? 'Żaden blok nie jest teraz aktywny.'
                    : 'Nie masz zaplanowanych bloków na dziś.'}
                </div>
                {nextBlock && (
                  <div className="today-active-empty-sub">
                    Następny: <strong>{nextBlock.title}</strong> o {formatTime(nextBlock.startMinutes)}
                  </div>
                )}
              </div>
            )}
          </section>
        </div>
      </div>

      {pendingSlot && (
        <CreateSlotModal
          defaultDate={todayStr}
          defaultStartMinutes={pendingSlot.startMinutes}
          defaultEndMinutes={pendingSlot.endMinutes}
          areas={areas}
          lifters={lifters}
          projects={projects}
          contexts={contexts}
          blockTemplates={blockTemplates}
          onSaveBlock={data => { onAddWorkBlock(data); setPendingSlot(null); }}
          onSaveEvent={async data => { const ev = await onAddEvent(data); setSelectedEventId(ev.id); setPendingSlot(null); }}
          onClose={() => setPendingSlot(null)}
        />
      )}
    </>
  );
}
