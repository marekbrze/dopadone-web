import { useState, useEffect, useRef } from 'react';
import React from 'react';
import type { Area, Lifter, Project, Task, Context, WorkBlock, CalendarEvent, BlockTemplate, ProjectNote } from '../types';
import { EventDetailPanel } from './EventDetailPanel';
import { ActiveEventPanel } from './ActiveEventPanel';
import { CreateSlotModal } from './CreateSlotModal';
import { WorkBlockModal } from './WorkBlockModal';
import { TaskDetailPanel } from './TaskDetailPanel';
import { PlannedDatePicker } from './PlannedDatePicker';

interface Props {
  areas: Area[];
  lifters: Lifter[];
  projects: Project[];
  tasks: Task[];
  contexts: Context[];
  workBlocks: WorkBlock[];
  events: CalendarEvent[];
  onUpdateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  onDeleteTask: (id: string) => void;
  onCompleteWithNextAction: (task: Task, nextActionName: string) => void;
  onSplitTask?: (task: Task, names: string[]) => Promise<void>;
  onAddEvent: (data: Omit<CalendarEvent, 'id'>) => Promise<CalendarEvent>;
  onUpdateEvent: (id: string, updates: Partial<CalendarEvent>) => Promise<void>;
  onDeleteEvent: (id: string) => Promise<void>;
  onAddEventTask: (eventId: string, name: string) => Promise<void>;
  onAddWorkBlock: (data: Omit<WorkBlock, 'id'>) => void;
  onUpdateWorkBlock: (id: string, updates: Partial<WorkBlock>) => void;
  onDeleteWorkBlock: (id: string) => void;
  onDuplicateWorkBlock: (id: string) => void;
  blockTemplates?: BlockTemplate[];
  notes: ProjectNote[];
  onAddNote: (projectId: string, data: { title?: string; content: string }) => Promise<void>;
  onUpdateNote: (id: string, updates: Partial<ProjectNote>) => Promise<void>;
  onDeleteNote: (id: string) => Promise<void>;
  onAddInboxTask: (name: string) => Promise<string>;
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
    const effortLevels = block.effortLevels ?? [];
    if (effortLevels.length > 0 && (task.effort === null || !effortLevels.includes(task.effort))) return false;
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
    const effortLevels = block.effortLevels ?? [];
    if (effortLevels.length > 0 && (task.effort === null || !effortLevels.includes(task.effort))) return false;
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

export function TodayView({ areas, lifters, projects, tasks, contexts, workBlocks, events, onUpdateTask, onDeleteTask, onCompleteWithNextAction, onSplitTask, onAddEvent, onUpdateEvent, onDeleteEvent, onAddEventTask, onAddWorkBlock, onUpdateWorkBlock, onDeleteWorkBlock, onDuplicateWorkBlock, blockTemplates = [], notes, onAddNote, onUpdateNote, onDeleteNote, onAddInboxTask }: Props) {
  const [now, setNow] = useState(() => new Date());
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const [editingBlock, setEditingBlock] = useState<WorkBlock | null>(null);
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
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [plannedExpanded, setPlannedExpanded] = useState(true);
  const [newPlannedTaskName, setNewPlannedTaskName] = useState('');
  const [showPlannedDone, setShowPlannedDone] = useState(false);
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
  const [eventDragState, setEventDragState] = useState<{
    eventId: string;
    offsetMinutes: number;
    currentMinutes: number;
    duration: number;
    startClientY: number;
    hasMoved: boolean;
  } | null>(null);
  const eventDragMovedRef = useRef(false);
  const [resizeDragState, setResizeDragState] = useState<{
    itemId: string;
    itemType: 'block' | 'event';
    originalStartMinutes: number;
    originalEndMinutes: number;
    currentEndMinutes: number;
    startClientY: number;
    hasMoved: boolean;
  } | null>(null);
  const resizeMovedRef = useRef(false);
  const [pendingSlot, setPendingSlot] = useState<{ startMinutes: number; endMinutes: number } | null>(null);
  const [mobileAgendaOpen, setMobileAgendaOpen] = useState(false);
  const [agendaWidth, setAgendaWidth] = useState(220);
  const [noteInputs, setNoteInputs] = useState<Record<string, string>>({});
  const agendaPanelResizing = useRef(false);
  const agendaPanelResizeStartX = useRef(0);
  const agendaPanelResizeStartWidth = useRef(0);
  const timelineRef = useRef<HTMLDivElement>(null);
  const touchStartRef = useRef<{ y: number; minutes: number } | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1_000);
    return () => clearInterval(id);
  }, []);

  // Scroll timeline to center on current time — on mount and when mobile drawer opens
  const scrollToNow = () => {
    if (!timelineRef.current) return;
    const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
    const containerHeight = timelineRef.current.clientHeight;
    const offset = Math.max(0, nowMin - Math.floor(containerHeight / 2));
    timelineRef.current.scrollTop = offset;
  };

  useEffect(() => {
    scrollToNow();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (mobileAgendaOpen) {
      // rAF ensures the drawer is visible (display:flex) before measuring clientHeight
      requestAnimationFrame(() => scrollToNow());
    }
  }, [mobileAgendaOpen]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const handleGlobalMouseMove = (e: MouseEvent) => {
      if (!agendaPanelResizing.current) return;
      const delta = e.clientX - agendaPanelResizeStartX.current;
      const newWidth = Math.max(160, Math.min(400, agendaPanelResizeStartWidth.current + delta));
      setAgendaWidth(newWidth);
    };
    document.addEventListener('mousemove', handleGlobalMouseMove);

    const handleGlobalMouseUp = () => {
      if (agendaPanelResizing.current) {
        agendaPanelResizing.current = false;
        document.body.style.cursor = '';
        return;
      }
      if (resizeDragState) {
        if (resizeMovedRef.current) {
          if (resizeDragState.itemType === 'block') {
            onUpdateWorkBlock(resizeDragState.itemId, { endMinutes: resizeDragState.currentEndMinutes });
          } else {
            onUpdateEvent(resizeDragState.itemId, { endMinutes: resizeDragState.currentEndMinutes });
          }
        }
        setResizeDragState(null);
        resizeMovedRef.current = false;
        return;
      }
      if (eventDragState) {
        if (eventDragMovedRef.current) {
          onUpdateEvent(eventDragState.eventId, {
            startMinutes: eventDragState.currentMinutes,
            endMinutes: eventDragState.currentMinutes + eventDragState.duration,
          });
        }
        setEventDragState(null);
        eventDragMovedRef.current = false;
        return;
      }
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
    return () => {
      document.removeEventListener('mousemove', handleGlobalMouseMove);
      document.removeEventListener('mouseup', handleGlobalMouseUp);
    };
  }, [dragState, blockDragState, eventDragState, resizeDragState]);

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

  const blockProjectNoteGroups = React.useMemo(() => {
    if (!displayBlock) return [];
    const allBlockTasks = [...blockUndoneTasks, ...blockDoneTasks];
    const projectIds = [...new Set(allBlockTasks.map(t => t.projectId).filter((id): id is string => id !== null))];
    return projectIds
      .map(pid => {
        const project = projects.find(p => p.id === pid);
        if (!project) return null;
        const projectNotes = notes.filter(n => n.projectId === pid);
        return { project, notes: projectNotes };
      })
      .filter((g): g is { project: Project; notes: ProjectNote[] } => g !== null)
      .sort((a, b) => a.project.name.localeCompare(b.project.name));
  }, [displayBlock, blockUndoneTasks, blockDoneTasks, projects, notes]);

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

  const nextEvent = currentEvent === null
    ? timedEvents.find(e => (e.startMinutes ?? 0) > nowMinutes)
    : null;

  const secondsUntilNextBlock = nextBlock
    ? Math.max(0, nextBlock.startMinutes * 60 - nowSeconds)
    : null;
  const secondsUntilNextEvent = nextEvent
    ? Math.max(0, (nextEvent.startMinutes ?? 0) * 60 - nowSeconds)
    : null;

  const plannedTasks = React.useMemo(
    () => tasks.filter(t => !t.done && t.plannedDate != null && t.plannedDate <= todayStr),
    [tasks, todayStr]
  );

  const plannedDoneTasks = React.useMemo(
    () => tasks.filter(t => t.done && t.plannedDate != null && t.plannedDate <= todayStr),
    [tasks, todayStr]
  );

  const handleAddPlannedTask = async () => {
    const name = newPlannedTaskName.trim();
    if (!name) return;
    const id = await onAddInboxTask(name);
    await onUpdateTask(id, { plannedDate: todayStr });
    setNewPlannedTaskName('');
  };

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

  const getMinutesFromTouch = (touch: { clientY: number }, el: HTMLElement): number => {
    const rect = el.getBoundingClientRect();
    const y = touch.clientY - rect.top;
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

        {/* Mobile: current block summary bar */}
        <div className="today-mobile-block-bar">
          <div
            className="today-mobile-block-indicator"
            style={{ background: currentBlock ? getBlockColor(currentBlock, areas) : 'var(--border)' }}
          />
          <div className="today-mobile-block-info">
            {currentBlock ? (
              <>
                <span className="today-mobile-block-title">{currentBlock.title}</span>
                <span className="today-mobile-block-time">
                  {formatTime(currentBlock.startMinutes)} – {formatTime(currentBlock.endMinutes)}
                  {isCurrentlyActive && (
                    <span className="today-mobile-countdown" style={{ color: getCountdownColor(remainingPct) }}>
                      {' '}· {formatCountdown(remainingSeconds)}
                    </span>
                  )}
                </span>
              </>
            ) : (
              <span className="today-mobile-block-title today-mobile-no-block">Brak aktywnego bloku</span>
            )}
          </div>
          <button
            className="today-mobile-agenda-btn"
            onClick={() => setMobileAgendaOpen(true)}
            aria-label="Otwórz harmonogram"
          >≡</button>
        </div>

        <div className="today-body">
          {/* LEFT: day timeline */}
          <aside className={`today-agenda${mobileAgendaOpen ? ' mobile-open' : ''}`} style={{ width: agendaWidth }}>
            <div className="today-agenda-mobile-close">
              <span>Harmonogram dnia</span>
              <button onClick={() => setMobileAgendaOpen(false)}>✕</button>
            </div>
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
                    const blockEl = (e.target as HTMLElement).closest<HTMLElement>('[data-block-id]');
                    if (blockEl) {
                      const blockId = blockEl.dataset.blockId!;
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
                    const eventEl = (e.target as HTMLElement).closest<HTMLElement>('[data-event-id]');
                    if (eventEl) {
                      const eventId = eventEl.dataset.eventId!;
                      const event = events.find(ev => ev.id === eventId);
                      if (!event || event.allDay) return;
                      e.preventDefault();
                      const minutes = getMinutesFromEvent(e);
                      const start = event.startMinutes ?? 0;
                      setEventDragState({
                        eventId,
                        offsetMinutes: Math.max(0, minutes - start),
                        currentMinutes: start,
                        duration: (event.endMinutes ?? start + 60) - start,
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
                    if (resizeDragState) {
                      const delta = e.clientY - resizeDragState.startClientY;
                      const raw = resizeDragState.originalEndMinutes + delta;
                      const snapped = Math.max(
                        resizeDragState.originalStartMinutes + 15,
                        Math.min(snap15(raw), 1440)
                      );
                      const moved = resizeDragState.hasMoved || Math.abs(delta) > 4;
                      if (moved) resizeMovedRef.current = true;
                      setResizeDragState(prev => prev ? { ...prev, currentEndMinutes: snapped, hasMoved: moved } : null);
                      return;
                    }
                    if (eventDragState) {
                      const minutes = getMinutesFromEvent(e);
                      const newStart = Math.max(0, Math.min(snap15(minutes - eventDragState.offsetMinutes), 1440 - eventDragState.duration));
                      const moved = eventDragState.hasMoved || Math.abs(e.clientY - eventDragState.startClientY) > 8;
                      if (moved) eventDragMovedRef.current = true;
                      setEventDragState(prev => prev ? { ...prev, currentMinutes: newStart, hasMoved: moved } : null);
                      return;
                    }
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
                  onTouchStart={e => {
                    const touch = e.touches[0];
                    const minutes = getMinutesFromTouch(touch, e.currentTarget);
                    touchStartRef.current = { y: touch.clientY, minutes };
                  }}
                  onTouchEnd={e => {
                    const start = touchStartRef.current;
                    if (!start) return;
                    const touch = e.changedTouches[0];
                    const moved = Math.abs(touch.clientY - start.y) > 12;
                    touchStartRef.current = null;
                    if (moved) return; // scroll — ignore
                    // Tap: open create-slot modal at tapped time
                    const tappedEl = document.elementFromPoint(touch.clientX, touch.clientY);
                    if (tappedEl && (tappedEl.closest('[data-block-id]') || tappedEl.closest('[data-event-id]'))) return;
                    setPendingSlot({ startMinutes: start.minutes, endMinutes: Math.min(start.minutes + 60, 1440) });
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
                    const isResizing = resizeDragState?.itemId === block.id && resizeDragState.itemType === 'block';
                    const top = isDragging ? blockDragState!.currentMinutes : block.startMinutes;
                    const endMin = isResizing ? resizeDragState!.currentEndMinutes : block.endMinutes;
                    const height = Math.max(endMin - top, 20);
                    const isSelected = block.id === (selectedBlockId ?? currentBlock?.id);
                    return (
                      <div
                        key={block.id}
                        data-block-id={block.id}
                        className={`agenda-block${isSelected ? ' selected' : ''}${isDragging ? ' dragging' : ''}${isResizing ? ' resizing' : ''}`}
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
                            : isResizing
                            ? `${formatTime(top)}–${formatTime(resizeDragState!.currentEndMinutes)}`
                            : `${formatTime(block.startMinutes)}–${formatTime(block.endMinutes)}`}
                        </span>
                        <div
                          className="resize-handle"
                          onMouseDown={e => {
                            e.stopPropagation();
                            e.preventDefault();
                            setResizeDragState({
                              itemId: block.id,
                              itemType: 'block',
                              originalStartMinutes: block.startMinutes,
                              originalEndMinutes: block.endMinutes,
                              currentEndMinutes: block.endMinutes,
                              startClientY: e.clientY,
                              hasMoved: false,
                            });
                          }}
                        />
                      </div>
                    );
                  })}

                  {/* Timed events */}
                  {timedEvents.map(event => {
                    const isEventDragging = eventDragState?.eventId === event.id && eventDragState.hasMoved;
                    const isResizing = resizeDragState?.itemId === event.id && resizeDragState.itemType === 'event';
                    const start = isEventDragging ? eventDragState!.currentMinutes : (event.startMinutes ?? 0);
                    const rawEnd = event.endMinutes ?? (event.startMinutes ?? 0) + 60;
                    const end = isResizing ? resizeDragState!.currentEndMinutes : rawEnd;
                    const height = Math.max(end - start, 20);
                    const isSelected = selectedEventId === event.id;
                    return (
                      <div
                        key={event.id}
                        data-event-id={event.id}
                        className={`agenda-block agenda-event${isSelected ? ' selected' : ''}${isEventDragging ? ' dragging' : ''}${isResizing ? ' resizing' : ''}`}
                        style={{
                          top: `${start}px`,
                          height: `${height}px`,
                          background: EVENT_COLOR + '22',
                          borderLeft: `3px solid ${EVENT_COLOR}`,
                        }}
                        onClick={() => {
                          if (eventDragMovedRef.current) { eventDragMovedRef.current = false; return; }
                          handleEventClick(event.id);
                        }}
                      >
                        <span className="agenda-block-title">◈ {event.title}</span>
                        {height >= 35 && (
                          <span className="agenda-block-time">
                            {formatTime(start)}–{formatTime(end)}
                          </span>
                        )}
                        <div
                          className="resize-handle"
                          onMouseDown={e => {
                            e.stopPropagation();
                            e.preventDefault();
                            setResizeDragState({
                              itemId: event.id,
                              itemType: 'event',
                              originalStartMinutes: event.startMinutes ?? 0,
                              originalEndMinutes: rawEnd,
                              currentEndMinutes: rawEnd,
                              startClientY: e.clientY,
                              hasMoved: false,
                            });
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </aside>

          {/* Resize handle between agenda and active panel */}
          <div
            className="today-agenda-resize-handle"
            onMouseDown={e => {
              e.preventDefault();
              agendaPanelResizing.current = true;
              agendaPanelResizeStartX.current = e.clientX;
              agendaPanelResizeStartWidth.current = agendaWidth;
              document.body.style.cursor = 'col-resize';
            }}
          />

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
                      <button
                        className="today-block-duplicate-btn"
                        onClick={() => setEditingBlock(displayBlock)}
                        title="Edytuj blok"
                      >Edytuj blok</button>
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
                          className={`today-task-item${selectedTaskId === task.id ? ' selected' : ''}`}
                          onClick={() => setSelectedTaskId(prev => prev === task.id ? null : task.id)}
                        >
                          <input
                            type="checkbox"
                            checked={false}
                            onChange={() => onUpdateTask(task.id, { done: true })}
                            id={`today-task-${task.id}`}
                            onClick={e => e.stopPropagation()}
                          />
                          <span className="today-task-name">{task.name}</span>
                          <span
                            className="today-priority-dot"
                            style={{ background: priorityColors[task.priority] }}
                            title={task.priority}
                          />
                          {displayBlock.blockType === 'manual' && (
                            <button
                              className="today-task-remove-btn"
                              onClick={e => { e.stopPropagation(); handleRemoveTaskFromBlock(task.id); }}
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
                                <div
                                  key={task.id}
                                  className={`today-task-item${selectedTaskId === task.id ? ' selected' : ''}`}
                                  onClick={() => setSelectedTaskId(prev => prev === task.id ? null : task.id)}
                                >
                                  <input
                                    type="checkbox"
                                    checked={false}
                                    onChange={() => onUpdateTask(task.id, { done: true })}
                                    id={`today-task-${task.id}`}
                                    onClick={e => e.stopPropagation()}
                                  />
                                  <span className="today-task-name">{task.name}</span>
                                  <span
                                    className="today-priority-dot"
                                    style={{ background: priorityColors[task.priority] }}
                                    title={task.priority}
                                  />
                                  {displayBlock.blockType === 'manual' && (
                                    <button
                                      className="today-task-remove-btn"
                                      onClick={e => { e.stopPropagation(); handleRemoveTaskFromBlock(task.id); }}
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
                            <div
                              key={task.id}
                              className={`today-task-item${selectedTaskId === task.id ? ' selected' : ''}`}
                              onClick={() => setSelectedTaskId(prev => prev === task.id ? null : task.id)}
                            >
                              <input
                                type="checkbox"
                                checked={false}
                                onChange={() => onUpdateTask(task.id, { done: true })}
                                id={`today-task-${task.id}`}
                                onClick={e => e.stopPropagation()}
                              />
                              <span className="today-task-name">{task.name}</span>
                              <span
                                className="today-priority-dot"
                                style={{ background: priorityColors[task.priority] }}
                                title={task.priority}
                              />
                              {displayBlock.blockType === 'manual' && (
                                <button
                                  className="today-task-remove-btn"
                                  onClick={e => { e.stopPropagation(); handleRemoveTaskFromBlock(task.id); }}
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
                              className={`today-task-item done${selectedTaskId === task.id ? ' selected' : ''}`}
                              onClick={() => setSelectedTaskId(prev => prev === task.id ? null : task.id)}
                            >
                              <input
                                type="checkbox"
                                checked={true}
                                onChange={() => onUpdateTask(task.id, { done: false })}
                                id={`today-task-done-${task.id}`}
                                onClick={e => e.stopPropagation()}
                              />
                              <span className="today-task-name">{task.name}</span>
                              <span
                                className="today-priority-dot"
                                style={{ background: priorityColors[task.priority] }}
                                title={task.priority}
                              />
                              {displayBlock.blockType === 'manual' && (
                                <button
                                  className="today-task-remove-btn"
                                  onClick={e => { e.stopPropagation(); handleRemoveTaskFromBlock(task.id); }}
                                  title="Usuń z bloku"
                                >✕</button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}
                  {blockProjectNoteGroups.length > 0 && (
                    <div className="today-block-notes-section">
                      <div className="agenda-block-notes-header">Notatki projektów</div>
                      {blockProjectNoteGroups.map(({ project, notes: pNotes }) => (
                        <div key={project.id} className="block-notes-project-group">
                          <div className="block-notes-project-header">
                            <span>{project.name}</span>
                          </div>
                          {[...pNotes]
                            .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                            .map(note => (
                              <div key={note.id} className="block-note-card">
                                {note.title && <div className="block-note-title">{note.title}</div>}
                                <div className="block-note-content">{note.content}</div>
                                <div className="block-note-meta">
                                  {new Date(note.updatedAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}
                                  <button
                                    className="block-note-delete"
                                    onClick={() => onDeleteNote(note.id)}
                                    title="Usuń notatkę"
                                  >✕</button>
                                </div>
                              </div>
                            ))
                          }
                          <div className="block-note-add">
                            <textarea
                              className="block-note-add-input"
                              placeholder={`Dodaj notatkę do „${project.name}"…`}
                              value={noteInputs[project.id] ?? ''}
                              onChange={e => setNoteInputs(prev => ({ ...prev, [project.id]: e.target.value }))}
                              onKeyDown={async e => {
                                if (e.key === 'Enter' && e.ctrlKey && (noteInputs[project.id] ?? '').trim()) {
                                  await onAddNote(project.id, { content: noteInputs[project.id].trim() });
                                  setNoteInputs(prev => ({ ...prev, [project.id]: '' }));
                                }
                              }}
                              rows={2}
                            />
                            <button
                              className="block-note-add-btn"
                              disabled={!(noteInputs[project.id] ?? '').trim()}
                              onClick={async () => {
                                const content = (noteInputs[project.id] ?? '').trim();
                                if (!content) return;
                                await onAddNote(project.id, { content });
                                setNoteInputs(prev => ({ ...prev, [project.id]: '' }));
                              }}
                            >Dodaj</button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </>
            ) : (
              <div className="today-empty-wrapper">
                <div className="today-active-empty-state">
                  <div className="today-active-empty-icon">◎</div>
                  <div className="today-active-empty-msg">
                    Żaden blok nie jest teraz aktywny.
                  </div>
                  {(nextBlock || nextEvent) && (
                    <div className="today-active-empty-sub">
                      {nextBlock && (
                        <div>
                          Następny blok: <strong>{nextBlock.title}</strong> o {formatTime(nextBlock.startMinutes)}
                          {secondsUntilNextBlock != null && (
                            <span className="today-block-countdown" style={{ marginLeft: 8, color: 'var(--text-faint)' }}>
                              za {formatCountdown(secondsUntilNextBlock)}
                            </span>
                          )}
                        </div>
                      )}
                      {nextEvent && (
                        <div>
                          Następne wydarzenie: <strong>{nextEvent.title}</strong> o {formatTime(nextEvent.startMinutes ?? 0)}
                          {secondsUntilNextEvent != null && (
                            <span className="today-block-countdown" style={{ marginLeft: 8, color: 'var(--text-faint)' }}>
                              za {formatCountdown(secondsUntilNextEvent)}
                            </span>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                <div className="inbox-add-row">
                  <input
                    type="text"
                    className="inbox-add-input"
                    placeholder="Dodaj zadanie do Inboxu..."
                    value={newPlannedTaskName}
                    onChange={e => setNewPlannedTaskName(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddPlannedTask(); }}
                  />
                  <button
                    className="inbox-add-btn"
                    onClick={handleAddPlannedTask}
                    disabled={!newPlannedTaskName.trim()}
                  >Dodaj</button>
                </div>
                {plannedTasks.length > 0 && (
                  <div className="today-planned-section">
                    <button
                      className="today-planned-toggle"
                      onClick={() => setPlannedExpanded(v => !v)}
                    >
                      {plannedExpanded ? '▾' : '▸'} Zaplanowane na dziś
                      <span className="today-tasks-count"> ({plannedTasks.length})</span>
                    </button>
                    {plannedExpanded && (
                      <div className="today-planned-list">
                        {plannedTasks.map(task => {
                          const project = projects.find(p => p.id === task.projectId);
                          return (
                            <div
                              key={task.id}
                              className="today-task-item"
                              onClick={() => setSelectedTaskId(prev => prev === task.id ? null : task.id)}
                            >
                              <input
                                type="checkbox"
                                checked={false}
                                onChange={() => onUpdateTask(task.id, { done: true })}
                                onClick={e => e.stopPropagation()}
                              />
                              <span className="today-task-name">{task.name}</span>
                              {project && <span className="today-planned-project">{project.name}</span>}
                              <PlannedDatePicker
                                date={task.plannedDate}
                                isNext={task.isNext}
                                today={todayStr}
                                onChange={(date, isNext) => onUpdateTask(task.id, { plannedDate: date, isNext: isNext ?? false })}
                              />
                              <span
                                className="today-priority-dot"
                                style={{ background: priorityColors[task.priority] }}
                                title={task.priority}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
                {plannedDoneTasks.length > 0 && (
                  <div className="inbox-done-section">
                    <button
                      className="inbox-done-toggle"
                      onClick={() => setShowPlannedDone(v => !v)}
                    >
                      {showPlannedDone ? '▾' : '▸'} Ukończone ({plannedDoneTasks.length})
                    </button>
                    {showPlannedDone && (
                      <div className="inbox-list inbox-list-done">
                        {plannedDoneTasks.map(task => {
                          const project = projects.find(p => p.id === task.projectId);
                          return (
                            <div
                              key={task.id}
                              className={`today-task-item done${selectedTaskId === task.id ? ' selected' : ''}`}
                              onClick={() => setSelectedTaskId(prev => prev === task.id ? null : task.id)}
                            >
                              <input
                                type="checkbox"
                                checked={true}
                                onChange={() => onUpdateTask(task.id, { done: false })}
                                onClick={e => e.stopPropagation()}
                              />
                              <span className="today-task-name">{task.name}</span>
                              {project && <span className="today-planned-project">{project.name}</span>}
                              <span
                                className="today-priority-dot"
                                style={{ background: priorityColors[task.priority] }}
                                title={task.priority}
                              />
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </section>

          {selectedTaskId && (() => {
            const task = tasks.find(t => t.id === selectedTaskId);
            return task ? (
              <TaskDetailPanel
                task={task}
                contexts={contexts}
                project={projects.find(p => p.id === task.projectId) ?? null}
                onUpdate={(key, value) => onUpdateTask(selectedTaskId, { [key]: value })}
                onDelete={() => { onDeleteTask(selectedTaskId); setSelectedTaskId(null); }}
                onClose={() => setSelectedTaskId(null)}
                onCompleteWithNextAction={(name) => { onCompleteWithNextAction(task, name); setSelectedTaskId(null); }}
                onSplit={onSplitTask ? async (names) => { await onSplitTask(task, names); setSelectedTaskId(null); } : undefined}
              />
            ) : null;
          })()}
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
          onSave={data => { onUpdateWorkBlock(editingBlock.id, data); setEditingBlock(null); }}
          onDelete={() => { onDeleteWorkBlock(editingBlock.id); setEditingBlock(null); setSelectedBlockId(null); }}
          onClose={() => setEditingBlock(null)}
        />
      )}
    </>
  );
}
