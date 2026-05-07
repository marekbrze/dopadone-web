import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { Task, Project, Area, Lifter, DragPayload } from '../types';
import { ProjectTree } from './ProjectTree';
import './ProcessingView.css';
import './ProjectReviewView.css';

interface ProjectReviewViewProps {
  areaId: string;
  projects: Project[];
  tasks: Task[];
  areas: Area[];
  lifters: Lifter[];
  onArchiveProject: (id: string) => Promise<void>;
  onDeleteProject: (id: string) => Promise<void>;
  onUpdateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  onAddTaskToProject: (name: string, projectId: string) => Promise<void>;
  onReorderProject: (projectId: string, insertAfterProjectId: string | null) => Promise<void>;
  onAddProject: (name: string, areaId: string, lifterId: string | null) => Promise<Project>;
  onClose: () => void;
}

type ReviewScreen = 'lifter-summary' | 'processing' | 'lifter-transition' | 'done';

interface LifterQueueItem {
  lifterId: string | null;
  name: string;
}

interface LifterStats {
  lifterId: string | null;
  name: string;
  processed: number;
  archived: number;
  tasksMarkedDone: number;
  tasksAdded: number;
  elapsedMs: number;
  skipped?: boolean;
}

function formatElapsed(ms: number): string {
  const mins = Math.floor(ms / 60000);
  const secs = Math.floor((ms % 60000) / 1000);
  return `${mins}:${String(secs).padStart(2, '0')}`;
}

function ElapsedTimer({ ms, label }: { ms: number; label?: string }) {
  return (
    <span className="pr-elapsed-timer" aria-live="off">
      {label && <span className="pr-timer-label">{label}</span>}
      <span className="pr-timer-value">{formatElapsed(ms)}</span>
    </span>
  );
}

export function ProjectReviewView({
  areaId, projects, tasks, areas, lifters,
  onArchiveProject, onDeleteProject, onUpdateTask, onAddTaskToProject, onReorderProject, onAddProject, onClose,
}: ProjectReviewViewProps) {
  const [screen, setScreen] = useState<ReviewScreen>('lifter-summary');
  const [markedForArchive, setMarkedForArchive] = useState<Set<string>>(new Set());

  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [taskCursorIndex, setTaskCursorIndex] = useState(0);
  const [quickAddName, setQuickAddName] = useState('');
  const [quickAddProjectName, setQuickAddProjectName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [stats, setStats] = useState({ processed: 0, archived: 0, tasksMarkedDone: 0, tasksAdded: 0 });

  // Lifter iteration
  const [lifterIndex, setLifterIndex] = useState(0);
  const [lifterElapsedMs, setLifterElapsedMs] = useState(0);
  const [totalElapsedMs, setTotalElapsedMs] = useState(0);
  const [lifterStats, setLifterStats] = useState<LifterStats[]>([]);

  // D&D state
  const [reviewDragPayload, setReviewDragPayload] = useState<DragPayload | null>(null);
  const [reviewDropGapTarget, setReviewDropGapTarget] = useState<string | null>(null);

  const quickAddRef = useRef<HTMLInputElement>(null);
  const quickAddProjectRef = useRef<HTMLInputElement>(null);
  const taskListRef = useRef<HTMLDivElement>(null);
  const confirmCancelRef = useRef<HTMLButtonElement>(null);

  const area = useMemo(() => areas.find(a => a.id === areaId), [areas, areaId]);

  // Build lifter queue
  const lifterQueue = useMemo((): LifterQueueItem[] => {
    const queue: LifterQueueItem[] = [];
    const areaLifters = lifters.filter(l => l.areaId === areaId);

    for (const lifter of areaLifters) {
      const hasProjects = projects.some(p => p.areaId === areaId && !p.archived && p.lifterId === lifter.id);
      if (hasProjects) {
        queue.push({ lifterId: lifter.id, name: lifter.name });
      }
    }

    const hasUnassigned = projects.some(p => p.areaId === areaId && !p.archived && !p.lifterId);
    if (hasUnassigned) {
      queue.push({ lifterId: null, name: 'Bez podobszaru' });
    }

    return queue;
  }, [lifters, projects, areaId]);

  const currentLifterItem = lifterQueue[lifterIndex] ?? null;
  const lifterProjects = useMemo(
    () => currentLifterItem
      ? projects
          .filter(p => p.areaId === areaId && !p.archived && p.lifterId === currentLifterItem.lifterId)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      : [],
    [projects, areaId, currentLifterItem],
  );

  const activeProjectIds = useMemo(() => {
    return projectIds.filter(id => {
      const p = projects.find(proj => proj.id === id);
      return p && !p.archived;
    });
  }, [projectIds, projects]);

  const currentProjectId = activeProjectIds[currentIndex] ?? null;
  const currentProject = currentProjectId ? projects.find(p => p.id === currentProjectId && !p.archived) ?? null : null;

  const projectTasks = useMemo(() => {
    if (!currentProjectId) return [];
    return tasks
      .filter(t => t.projectId === currentProjectId)
      .sort((a, b) => {
        if (a.done !== b.done) return a.done ? 1 : -1;
        return (a.order ?? 0) - (b.order ?? 0);
      });
  }, [tasks, currentProjectId]);

  const allDone = projectTasks.length > 0 && projectTasks.every(t => t.done);

  const lifter = useMemo(() => {
    if (!currentProject) return null;
    return currentProject.lifterId ? lifters.find(l => l.id === currentProject.lifterId) ?? null : null;
  }, [currentProject, lifters]);

  // ── Timer ──

  useEffect(() => {
    if (screen !== 'processing') return;
    const id = setInterval(() => {
      setLifterElapsedMs(prev => prev + 1000);
      setTotalElapsedMs(prev => prev + 1000);
    }, 1000);
    return () => clearInterval(id);
  }, [screen]);

  // ── Summary helpers ──

  const toggleMark = useCallback((projectId: string) => {
    setMarkedForArchive(prev => {
      const next = new Set(prev);
      if (next.has(projectId)) {
        next.delete(projectId);
      } else {
        next.add(projectId);
      }
      return next;
    });
  }, []);

  const handleQuickAddProject = useCallback(async () => {
    const name = quickAddProjectName.trim();
    if (!name || !currentLifterItem) return;
    await onAddProject(name, areaId, currentLifterItem.lifterId);
    setQuickAddProjectName('');
  }, [quickAddProjectName, currentLifterItem, areaId, onAddProject]);

  const handleStart = useCallback(async () => {
    for (const id of markedForArchive) {
      await onArchiveProject(id);
    }
    const archivedCount = markedForArchive.size;
    const remaining = lifterProjects.map(p => p.id).filter(id => !markedForArchive.has(id));

    if (remaining.length === 0) {
      setStats(s => ({ ...s, archived: archivedCount }));
      // No projects to process — finish this lifter immediately
      finishLifter({ processed: 0, archived: archivedCount, tasksMarkedDone: 0, tasksAdded: 0 });
      return;
    }

    setProjectIds(remaining);
    setCurrentIndex(0);
    setTaskCursorIndex(0);
    setStats(s => ({ ...s, archived: archivedCount }));
    setLifterElapsedMs(0);
    setScreen('processing');
  }, [markedForArchive, lifterProjects, onArchiveProject]);

  // ── Lifter transition ──

  const finishLifter = useCallback((lifterStatsEntry: { processed: number; archived: number; tasksMarkedDone: number; tasksAdded: number }) => {
    const item = lifterQueue[lifterIndex];
    const entry: LifterStats = {
      lifterId: item?.lifterId ?? null,
      name: item?.name ?? '(brak)',
      ...lifterStatsEntry,
      elapsedMs: lifterElapsedMs,
    };
    setLifterStats(prev => [...prev, entry]);

    if (lifterIndex < lifterQueue.length - 1) {
      setScreen('lifter-transition');
    } else {
      setScreen('done');
    }
  }, [lifterIndex, lifterQueue, lifterElapsedMs]);

  const handleNextLifter = useCallback(() => {
    setLifterIndex(i => i + 1);
    setMarkedForArchive(new Set());
    setStats({ processed: 0, archived: 0, tasksMarkedDone: 0, tasksAdded: 0 });
    setScreen('lifter-summary');
  }, []);

  const handleSkipLifter = useCallback(() => {
    // Skip the NEXT lifter
    const nextIndex = lifterIndex + 1;
    const skipItem = lifterQueue[nextIndex];
    if (skipItem) {
      setLifterStats(prev => [...prev, {
        lifterId: skipItem.lifterId,
        name: skipItem.name,
        processed: 0, archived: 0, tasksMarkedDone: 0, tasksAdded: 0,
        elapsedMs: 0,
        skipped: true,
      }]);
    }

    const afterSkipIndex = nextIndex + 1;
    if (afterSkipIndex < lifterQueue.length) {
      setLifterIndex(afterSkipIndex);
      setMarkedForArchive(new Set());
      setStats({ processed: 0, archived: 0, tasksMarkedDone: 0, tasksAdded: 0 });
      setScreen('lifter-summary');
    } else {
      setScreen('done');
    }
  }, [lifterIndex, lifterQueue]);

  const handleSkipCurrentLifter = useCallback(() => {
    const item = lifterQueue[lifterIndex];
    if (item) {
      setLifterStats(prev => [...prev, {
        lifterId: item.lifterId,
        name: item.name,
        processed: 0, archived: 0, tasksMarkedDone: 0, tasksAdded: 0,
        elapsedMs: 0,
        skipped: true,
      }]);
    }

    const nextIndex = lifterIndex + 1;
    if (nextIndex < lifterQueue.length) {
      setLifterIndex(nextIndex);
      setMarkedForArchive(new Set());
      setStats({ processed: 0, archived: 0, tasksMarkedDone: 0, tasksAdded: 0 });
      setScreen('lifter-summary');
    } else {
      setScreen('done');
    }
  }, [lifterIndex, lifterQueue]);

  // ── Processing helpers ──

  const advanceProject = useCallback(() => {
    if (currentIndex < activeProjectIds.length - 1) {
      setCurrentIndex(i => i + 1);
      setTaskCursorIndex(0);
      setConfirmDelete(null);
    } else {
      // Finish current lifter
      finishLifter(stats);
    }
  }, [currentIndex, activeProjectIds.length, finishLifter, stats]);

  const goBackProject = useCallback(() => {
    if (currentIndex > 0) {
      setCurrentIndex(i => i - 1);
      setTaskCursorIndex(0);
      setConfirmDelete(null);
    }
  }, [currentIndex]);

  const handleArchiveCurrent = useCallback(async () => {
    if (!currentProjectId) return;
    await onArchiveProject(currentProjectId);
    setStats(s => ({ ...s, processed: s.processed + 1, archived: s.archived + 1 }));
    // Don't call advanceProject — the archived project is removed from activeProjectIds,
    // so currentIndex naturally points to the next project.
  }, [currentProjectId, onArchiveProject]);

  const handleSkip = useCallback(() => {
    setStats(s => ({ ...s, processed: s.processed + 1 }));
    advanceProject();
  }, [advanceProject]);

  const handleDeleteCurrent = useCallback(async () => {
    if (!currentProjectId) return;
    await onDeleteProject(currentProjectId);
    setConfirmDelete(null);
    setStats(s => ({ ...s, processed: s.processed + 1 }));
    // Don't call advanceProject — same reason as handleArchiveCurrent.
  }, [currentProjectId, onDeleteProject]);

  const handleToggleTask = useCallback(async (task: Task) => {
    const newDone = !task.done;
    await onUpdateTask(task.id, { done: newDone });
    if (newDone) {
      setStats(s => ({ ...s, tasksMarkedDone: s.tasksMarkedDone + 1 }));
    }
  }, [onUpdateTask]);

  const handleQuickAdd = useCallback(async () => {
    if (!quickAddName.trim() || !currentProjectId) return;
    await onAddTaskToProject(quickAddName.trim(), currentProjectId);
    setQuickAddName('');
    setStats(s => ({ ...s, tasksAdded: s.tasksAdded + 1 }));
  }, [quickAddName, currentProjectId, onAddTaskToProject]);

  // ── D&D handlers ──

  const handleReviewDragStart = useCallback((id: string) => {
    setReviewDragPayload({ kind: 'project', projectId: id });
  }, []);

  const handleReviewDragEnd = useCallback(() => {
    setReviewDragPayload(null);
    setReviewDropGapTarget(null);
  }, []);

  const handleReviewGapDragOver = useCallback((e: React.DragEvent, insertAfterProjectId: string | null) => {
    if (!reviewDragPayload || reviewDragPayload.kind !== 'project') return;
    e.preventDefault();
    setReviewDropGapTarget(insertAfterProjectId);
  }, [reviewDragPayload]);

  const handleReviewGapDrop = useCallback((insertAfterProjectId: string | null) => {
    if (!reviewDragPayload || reviewDragPayload.kind !== 'project') return;
    setReviewDropGapTarget(null);
    onReorderProject(reviewDragPayload.projectId, insertAfterProjectId);
    setReviewDragPayload(null);
  }, [reviewDragPayload, onReorderProject]);

  // ── Scroll & focus effects ──

  // After archive/delete, if all projects in this lifter are gone, finish the lifter.
  useEffect(() => {
    if (screen !== 'processing') return;
    if (currentProject === null) {
      finishLifter(stats);
    }
  }, [screen, currentProject, finishLifter, stats]);

  useEffect(() => {
    if (screen !== 'processing') return;
    const list = taskListRef.current;
    if (!list) return;
    const highlighted = list.querySelector('.pr-task-row.highlighted') as HTMLElement | null;
    highlighted?.scrollIntoView({ block: 'nearest' });
  }, [taskCursorIndex, screen]);

  useEffect(() => {
    if (confirmDelete) {
      confirmCancelRef.current?.focus();
    }
  }, [confirmDelete]);

  // ── Keyboard handler ──

  useEffect(() => {
    if (screen === 'lifter-summary') {
      const handler = (e: KeyboardEvent) => {
        const tag = (e.target as HTMLElement).tagName;
        const inInput = tag === 'INPUT' || tag === 'TEXTAREA';
        if (inInput) {
          if (e.key === 'Escape') { e.preventDefault(); quickAddProjectRef.current?.blur(); }
          return;
        }
        if (e.key === 'Enter') { e.preventDefault(); handleStart(); }
        if (e.key === 's') { e.preventDefault(); handleSkipCurrentLifter(); }
        if (e.key === 'a') { e.preventDefault(); quickAddProjectRef.current?.focus(); }
        if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      };
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }

    if (screen === 'lifter-transition') {
      const handler = (e: KeyboardEvent) => {
        if (e.key === 'Enter') { e.preventDefault(); handleNextLifter(); }
        if (e.key === 's') { e.preventDefault(); handleSkipLifter(); }
        if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      };
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }

    if (screen === 'done') {
      const handler = (e: KeyboardEvent) => {
        if (e.key === 'Escape' || e.key === 'Enter') { e.preventDefault(); onClose(); }
      };
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }

    if (screen !== 'processing') return;

    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA';

      if (inInput) {
        if (e.key === 'Escape') { e.preventDefault(); quickAddRef.current?.blur(); }
        return;
      }

      if (confirmDelete) {
        if (e.key === 'Enter' || e.key === 'd') { e.preventDefault(); handleDeleteCurrent(); return; }
        if (e.key === 'Escape') { e.preventDefault(); setConfirmDelete(null); return; }
        return;
      }

      if (e.key === 'ArrowDown') {
        e.preventDefault();
        setTaskCursorIndex(i => projectTasks.length > 0 ? Math.min(i + 1, projectTasks.length - 1) : 0);
        return;
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault();
        setTaskCursorIndex(i => Math.max(i - 1, 0));
        return;
      }
      if (e.key === ' ' || e.key === 'Enter') {
        e.preventDefault();
        const task = projectTasks[taskCursorIndex];
        if (task) handleToggleTask(task);
        return;
      }
      if (e.key === 'a') { e.preventDefault(); quickAddRef.current?.focus(); return; }
      if (e.key === 'e') { e.preventDefault(); handleArchiveCurrent(); return; }
      if (e.key === 'd') { e.preventDefault(); if (currentProjectId) setConfirmDelete(currentProjectId); return; }
      if (e.key === 'ArrowRight') { e.preventDefault(); handleSkip(); return; }
      if (e.key === 'ArrowLeft') { e.preventDefault(); goBackProject(); return; }
      if (e.key === 'Escape') { e.preventDefault(); onClose(); return; }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [
    screen, projectTasks, taskCursorIndex, confirmDelete, currentProjectId,
    handleToggleTask, handleArchiveCurrent, handleDeleteCurrent, handleSkip,
    goBackProject, handleStart, handleNextLifter, handleSkipLifter, handleSkipCurrentLifter, onClose,
  ]);

  // ── No lifters / no projects ──

  if (lifterQueue.length === 0) {
    return (
      <div className="processing-view">
        <div className="proc-done">
          <div className="proc-done-icon">✓</div>
          <div className="proc-done-title">Brak aktywnych projektów w tym obszarze</div>
          <button className="proc-start-btn" onClick={onClose}>Zamknij</button>
        </div>
      </div>
    );
  }

  // ── Render: lifter-summary ──

  if (screen === 'lifter-summary') {
    const lifterProjectsCount = lifterProjects.length;
    return (
      <div className="processing-view">
        <div className="proc-summary">
          <div className="proc-summary-title">Przegląd: {area?.name ?? ''}</div>
          <div className="pr-lifter-header">
            <span className="pr-lifter-name">{currentLifterItem?.name ?? '(brak)'}</span>
            <span className="pr-lifter-count">{lifterProjectsCount} {lifterProjectsCount === 1 ? 'projekt' : 'projektów'}</span>
          </div>
          <div className="pr-project-list">
            <ProjectTree
              key={currentLifterItem?.lifterId ?? 'none'}
              projects={lifterProjects}
              selectedProjectId={null}
              onSelect={() => {}}
              checkboxMode
              checkedIds={markedForArchive}
              onToggleCheck={toggleMark}
              dragPayload={reviewDragPayload}
              dropGapTarget={reviewDropGapTarget}
              onProjectDragStart={handleReviewDragStart}
              onProjectDragEnd={handleReviewDragEnd}
              onGapDragOver={handleReviewGapDragOver}
              onGapDrop={handleReviewGapDrop}
              onGapDragLeave={() => setReviewDropGapTarget(null)}
            />
          </div>
          <div className="pr-quick-add">
            <input
              ref={quickAddProjectRef}
              type="text"
              placeholder="Dodaj projekt… (a)"
              aria-label="Dodaj projekt do podobszaru"
              value={quickAddProjectName}
              onChange={e => setQuickAddProjectName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && quickAddProjectName.trim()) {
                  e.preventDefault();
                  handleQuickAddProject();
                }
              }}
            />
          </div>
          <div className="pr-summary-actions">
            <button className="proc-start-btn" onClick={handleStart}>
              Start <kbd>↵</kbd>
            </button>
            <button className="proc-skip-btn" onClick={handleSkipCurrentLifter}>
              Pomiń <kbd>s</kbd>
            </button>
            <button className="proc-skip-btn" onClick={onClose}>
              Anuluj <kbd>Esc</kbd>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: lifter-transition ──

  if (screen === 'lifter-transition') {
    const lastStat = lifterStats[lifterStats.length - 1];
    const nextItem = lifterQueue[lifterIndex + 1];
    return (
      <div className="processing-view">
        <div className="pr-transition">
          <div className="pr-transition-icon">✓</div>
          <div className="pr-transition-title">Podobszar zakończony</div>
          {lastStat && (
            <div className="pr-transition-stats">
              <div className="pr-transition-name">{lastStat.name}</div>
              <div className="pr-transition-row">
                <span>{lastStat.processed} przetworzonych</span>
                <span>{lastStat.archived} zarchiwizowanych</span>
                <span>{lastStat.tasksMarkedDone} zadań done</span>
              </div>
              <div className="pr-transition-time">Czas: {formatElapsed(lastStat.elapsedMs)}</div>
            </div>
          )}
          {nextItem && (
            <div className="pr-transition-next">
              <span>Następny: <strong>{nextItem.name}</strong></span>
            </div>
          )}
          <div className="pr-transition-actions">
            {nextItem && (
              <>
                <button className="proc-start-btn" onClick={handleNextLifter}>
                  Dalej <kbd>↵</kbd>
                </button>
                <button className="proc-skip-btn" onClick={handleSkipLifter}>
                  Pomiń <kbd>s</kbd>
                </button>
              </>
            )}
            <button className="pr-action-btn back-btn" onClick={onClose}>
              Zamknij <kbd>Esc</kbd>
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ── Render: done ──

  if (screen === 'done') {
    const totals = lifterStats.reduce(
      (acc, s) => ({
        processed: acc.processed + s.processed,
        archived: acc.archived + s.archived,
        tasksMarkedDone: acc.tasksMarkedDone + s.tasksMarkedDone,
        tasksAdded: acc.tasksAdded + s.tasksAdded,
      }),
      { processed: 0, archived: 0, tasksMarkedDone: 0, tasksAdded: 0 },
    );

    return (
      <div className="processing-view">
        <div className="proc-done">
          <div className="proc-done-icon">✓</div>
          <div className="proc-done-title">Przegląd zakończony</div>
          <div className="pr-lifter-stats">
            {lifterStats.map((s, i) => (
              <div key={i} className={`pr-lifter-stat-row${s.skipped ? ' skipped' : ''}`}>
                <div className="pr-lifter-stat-name">
                  {s.name}
                  {s.skipped && <span className="pr-skipped-badge">pominięty</span>}
                </div>
                <div className="pr-lifter-stat-details">
                  <span>{s.processed} przetworzonych</span>
                  <span>{s.archived} zarchiwizowanych</span>
                  <span>{s.tasksMarkedDone} zadań done</span>
                  {!s.skipped && <span className="pr-lifter-stat-time">{formatElapsed(s.elapsedMs)}</span>}
                </div>
              </div>
            ))}
          </div>
          <div className="pr-total-stats">
            <div className="proc-stats">
              <div className="proc-stat-card">
                <div className="proc-stat-number">{totals.processed}</div>
                <div className="proc-stat-label">Przetworzono</div>
              </div>
              <div className="proc-stat-card">
                <div className="proc-stat-number">{totals.archived}</div>
                <div className="proc-stat-label">Zarchiwizowano</div>
              </div>
              <div className="proc-stat-card">
                <div className="proc-stat-number">{totals.tasksMarkedDone}</div>
                <div className="proc-stat-label">Zadania done</div>
              </div>
              <div className="proc-stat-card">
                <div className="proc-stat-number">{totals.tasksAdded}</div>
                <div className="proc-stat-label">Dodane zadania</div>
              </div>
            </div>
            <div className="pr-total-time">
              Łączny czas: <strong>{formatElapsed(totalElapsedMs)}</strong>
            </div>
          </div>
          <button className="proc-start-btn" onClick={onClose}>
            Zamknij <kbd>Esc</kbd>
          </button>
        </div>
      </div>
    );
  }

  // ── Render: processing ──

  if (!currentProject) {
    // Project was archived/deleted — useEffect will transition to next lifter
    return null;
  }

  const progressPct = activeProjectIds.length > 0 ? ((currentIndex + 1) / activeProjectIds.length) * 100 : 0;

  return (
    <div className="processing-view">
      <div className="pr-layout">
        <div className="pr-top-bar">
          <div className="pr-breadcrumb">
            {area && <span className="pr-breadcrumb-area">{area.name}</span>}
            {lifter && <><span className="pr-breadcrumb-sep"> / </span><span>{lifter.name}</span></>}
          </div>
          <ElapsedTimer ms={lifterElapsedMs} />
          <div className="pr-progress-info">
            {currentIndex + 1} / {activeProjectIds.length}
          </div>
          <button className="pr-close-btn" onClick={onClose} aria-label="Zamknij przegląd">✕</button>
        </div>
        <div className="proc-progress-bar" role="progressbar" aria-valuenow={currentIndex + 1} aria-valuemin={1} aria-valuemax={activeProjectIds.length} aria-label={`Postęp: ${currentIndex + 1} z ${activeProjectIds.length}`}>
          <div className="proc-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>

        <div className="proc-task-name">{currentProject.name}</div>

        {allDone && (
          <div className="pr-all-done-hint" role="status">
            Wszystkie zadania zrobione, rozważ archiwizację <kbd>e</kbd>
          </div>
        )}

        <div className="pr-divider" />

        <div className="pr-task-list" ref={taskListRef}>
          {projectTasks.length === 0 && (
            <div className="pr-empty-tasks">Brak zadań</div>
          )}
          {projectTasks.map((task, i) => (
            <div
              key={task.id}
              className={`pr-task-row${i === taskCursorIndex ? ' highlighted' : ''}${task.done ? ' done-task' : ''}`}
              role="button"
              tabIndex={0}
              aria-label={`${task.done ? 'Zrobione' : 'Do zrobienia'}: ${task.name}`}
              onClick={() => { setTaskCursorIndex(i); handleToggleTask(task); }}
              onMouseEnter={() => setTaskCursorIndex(i)}
              onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setTaskCursorIndex(i); handleToggleTask(task); } }}
            >
              <input
                type="checkbox"
                checked={task.done}
                onChange={() => handleToggleTask(task)}
                aria-label={task.name}
                tabIndex={-1}
              />
              <span className="pr-task-name">{task.name}</span>
            </div>
          ))}
        </div>

        <div className="pr-quick-add">
          <input
            ref={quickAddRef}
            type="text"
            placeholder="Dodaj zadanie… (a)"
            aria-label="Dodaj zadanie do projektu"
            value={quickAddName}
            onChange={e => setQuickAddName(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && quickAddName.trim()) {
                e.preventDefault();
                handleQuickAdd();
              }
            }}
          />
        </div>

        {confirmDelete && (
          <div className="pr-confirm-inline" role="alertdialog" aria-label="Potwierdzenie usunięcia projektu">
            <span>Usunąć projekt i wszystkie zadania?</span>
            <button className="pr-confirm-yes" onClick={handleDeleteCurrent}>Usuń <kbd>↵</kbd></button>
            <button className="pr-confirm-no" ref={confirmCancelRef} onClick={() => setConfirmDelete(null)}>Anuluj <kbd>Esc</kbd></button>
          </div>
        )}

        <div className="pr-action-bar">
          <button
            className={`pr-action-btn archive-btn${allDone ? ' suggested' : ''}`}
            onClick={handleArchiveCurrent}
            title="Zarchiwizuj (e)"
          >
            📦 Archiwizuj <kbd>e</kbd>
          </button>
          <button className="pr-action-btn skip-btn" onClick={handleSkip} title="Odłóż / następny (→)">
            Odłóż <kbd>→</kbd>
          </button>
          <button className="pr-action-btn delete-btn" onClick={() => setConfirmDelete(currentProjectId)} title="Usuń (d)">
            🗑 Usuń <kbd>d</kbd>
          </button>
          {currentIndex > 0 && (
            <button className="pr-action-btn back-btn" onClick={goBackProject} title="Poprzedni (←)">
              ← Poprzedni
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
