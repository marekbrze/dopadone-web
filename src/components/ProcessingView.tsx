import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { Task, Project, Context, TaskDuration, Effort, Area, Lifter } from '../types';
import { PlannedDatePicker } from './PlannedDatePicker';
import { addDays, formatPlannedDate, localDateStr, getDateOptions as getDateOptionsShared, type DateOption as DateOptionShared, parseDateInput } from './dateStepUtils';
import { BatteryIcon } from './BatteryIcon';
import './ProcessingView.css';

interface ProcessingViewProps {
  tasks: Task[];
  projects: Project[];
  areas: Area[];
  lifters: Lifter[];
  contexts: Context[];
  onUpdateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
  onCreateProject: (name: string, areaId: string, lifterId: string | null) => Promise<Project>;
  onConvertToProject: (taskId: string, projectName: string, areaId: string, lifterId: string | null, subtaskNames: string[]) => Promise<void>;
  onCreateLifter: (name: string, areaId: string) => Promise<Lifter>;
  onNavigateToToday: () => void;
}

type ProjectPanelMode = 'list' | 'new-project' | 'convert';

type ProcessingStepKind = 'project' | 'duration' | 'energy' | 'context' | 'date';
type ProcessingScreen = 'summary' | 'processing' | 'done';

interface ProcessingStep {
  taskId: string;
  kind: ProcessingStepKind;
}

const DURATION_OPTIONS: { key: string; value: TaskDuration; label: string }[] = [
  { key: '1', value: 5,   label: '5m' },
  { key: '2', value: 10,  label: '10m' },
  { key: '3', value: 15,  label: '15m' },
  { key: '4', value: 25,  label: '25m' },
  { key: '5', value: 45,  label: '45m' },
  { key: '6', value: 60,  label: '1h' },
  { key: '7', value: 90,  label: '1,5h' },
  { key: '8', value: 120, label: '2h' },
];

const ENERGY_OPTIONS: { key: string; value: Effort; label: string; color: string }[] = [
  { key: '1', value: 'low',    label: 'Niski',   color: '#5a7a5e' },
  { key: '2', value: 'medium', label: 'Średni',  color: '#a07830' },
  { key: '3', value: 'high',   label: 'Wysoki',  color: '#a33a2a' },
];

const OPTION_KEYS = ['1','2','3','4','5','6','7','8','9','0','a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t'];

function isProjectStartInFuture(project: Project | null | undefined, today: string): boolean {
  if (!project?.startDate) return false;
  const s = project.startDate;
  const padded = s.length === 4 ? s + '-01-01' : s.length === 7 ? s + '-01' : s;
  return padded > today;
}

function needsDateStep(task: Task, projects: Project[], today: string): boolean {
  if (task.plannedDate) return false;
  if (task.isNext) return false;
  const project = task.projectId ? projects.find(p => p.id === task.projectId) : null;
  return !isProjectStartInFuture(project, today);
}

function buildSession(tasks: Task[], projects: Project[], today: string): { sessionTaskIds: string[]; allSteps: ProcessingStep[] } {
  const eligible = tasks.filter(t =>
    !t.done && (
      t.projectId === null ||
      t.duration == null ||
      t.effort == null ||
      t.contextId === null ||
      needsDateStep(t, projects, today)
    )
  );
  const inboxFirst = [
    ...eligible.filter(t => t.projectId === null),
    ...eligible.filter(t => t.projectId !== null),
  ];

  const sessionTaskIds = inboxFirst.map(t => t.id);
  const allSteps: ProcessingStep[] = [];
  for (const task of inboxFirst) {
    if (task.projectId === null) allSteps.push({ taskId: task.id, kind: 'project' });
    if (task.duration == null)   allSteps.push({ taskId: task.id, kind: 'duration' });
    if (task.effort == null)     allSteps.push({ taskId: task.id, kind: 'energy' });
    if (task.contextId === null) allSteps.push({ taskId: task.id, kind: 'context' });
    if (needsDateStep(task, projects, today)) allSteps.push({ taskId: task.id, kind: 'date' });
  }

  return { sessionTaskIds, allSteps };
}

function durationKeyForValue(value: TaskDuration | null | undefined): string | null {
  if (value == null) return null;
  return DURATION_OPTIONS.find(o => o.value === value)?.key ?? null;
}

function energyKeyForValue(value: Effort | null | undefined): string | null {
  if (value == null) return null;
  return ENERGY_OPTIONS.find(o => o.value === value)?.key ?? null;
}

function contextKeyForId(contextId: string | null | undefined, contexts: Context[]): string | null {
  if (!contextId) return null;
  const idx = contexts.findIndex(c => c.id === contextId);
  return idx >= 0 ? (OPTION_KEYS[idx] ?? null) : null;
}

const TIMER_DURATION = 120; // 2 minutes in seconds

export function ProcessingView({ tasks, projects, areas, lifters, contexts, onUpdateTask, onDeleteTask, onCreateProject, onConvertToProject, onCreateLifter, onNavigateToToday }: ProcessingViewProps) {
  const [screen, setScreen] = useState<ProcessingScreen>('summary');
  const [sessionTaskIds, setSessionTaskIds] = useState<string[]>([]);
  const [allSteps, setAllSteps] = useState<ProcessingStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  // Project step state
  const [projectQuery, setProjectQuery] = useState('');
  const [projectCursorIndex, setProjectCursorIndex] = useState(0);
  const [projectPanelMode, setProjectPanelMode] = useState<ProjectPanelMode>('list');

  // Duration / Context step state
  const [pendingOptionKey, setPendingOptionKey] = useState<string | null>(null);

  // Date parser state
  const [showParser, setShowParser] = useState(false);
  const [parserText, setParserText] = useState('');

  // Timer state
  const [timerSeconds, setTimerSeconds] = useState(TIMER_DURATION);
  const timerTaskIdRef = useRef<string | null>(null);

  const projectInputRef = useRef<HTMLInputElement>(null);
  const projectListRef = useRef<HTMLDivElement>(null);

  const today = useMemo(() => localDateStr(), []);
  const dateOptions = useMemo(() => getDateOptions(today), [today]);

  // Summary stats (live from props)
  const inboxCount = useMemo(() => tasks.filter(t => !t.done && t.projectId === null).length, [tasks]);
  const noDurationCount = useMemo(() => tasks.filter(t => !t.done && t.duration == null).length, [tasks]);
  const noEnergyCount = useMemo(() => tasks.filter(t => !t.done && t.effort == null).length, [tasks]);
  const noContextCount = useMemo(() => tasks.filter(t => !t.done && t.contextId === null).length, [tasks]);
  const noDateCount = useMemo(
    () => tasks.filter(t => !t.done && needsDateStep(t, projects, today)).length,
    [tasks, projects, today]
  );
  const nothingToDo = inboxCount === 0 && noDurationCount === 0 && noEnergyCount === 0 && noContextCount === 0 && noDateCount === 0;

  const currentStep = allSteps[currentStepIndex] ?? null;
  const currentTask = useMemo(
    () => currentStep ? tasks.find(t => t.id === currentStep.taskId) ?? null : null,
    [currentStep, tasks]
  );

  // Filtered + sorted projects for project step
  const filteredProjects = useMemo(() => {
    const filtered = projectQuery.trim()
      ? projects.filter(p => p.name.toLowerCase().includes(projectQuery.toLowerCase()))
      : projects;
    return [...filtered].sort((a, b) => {
      const areaA = areas.find(ar => ar.id === a.areaId);
      const areaB = areas.find(ar => ar.id === b.areaId);
      const orderA = areaA?.order ?? 999;
      const orderB = areaB?.order ?? 999;
      if (orderA !== orderB) return orderA - orderB;
      if (a.areaId !== b.areaId) return a.areaId.localeCompare(b.areaId);
      const lifterA = a.lifterId ? (lifters.find(l => l.id === a.lifterId)?.name ?? '') : '';
      const lifterB = b.lifterId ? (lifters.find(l => l.id === b.lifterId)?.name ?? '') : '';
      if (lifterA !== lifterB) return lifterA.localeCompare(lifterB);
      return (a.order ?? 0) - (b.order ?? 0);
    });
  }, [projects, areas, lifters, projectQuery]);

  const resetStepState = useCallback(() => {
    setProjectQuery('');
    setProjectCursorIndex(0);
    setPendingOptionKey(null);
    setProjectPanelMode('list');
    setShowParser(false);
    setParserText('');
  }, []);

  const initPendingFromTask = useCallback((task: Task | null, kind: ProcessingStepKind) => {
    if (!task) return;
    if (kind === 'duration') {
      setPendingOptionKey(durationKeyForValue(task.duration));
    } else if (kind === 'energy') {
      setPendingOptionKey(energyKeyForValue(task.effort));
    } else if (kind === 'context') {
      setPendingOptionKey(contextKeyForId(task.contextId, contexts));
    }
  }, [contexts]);

  const markStepCompleted = useCallback((taskId: string, kind: ProcessingStepKind) => {
    setCompletedSteps(prev => new Set([...prev, `${taskId}:${kind}`]));
  }, []);

  const isTaskFullyProcessed = useCallback((taskId: string, steps: ProcessingStep[], completed: Set<string>) => {
    const taskSteps = steps.filter(s => s.taskId === taskId);
    return taskSteps.every(s => completed.has(`${s.taskId}:${s.kind}`));
  }, []);

  const advanceStep = useCallback((steps: ProcessingStep[], idx: number) => {
    if (idx < steps.length - 1) {
      const nextIdx = idx + 1;
      setCurrentStepIndex(nextIdx);
      resetStepState();
      // Pre-populate pending key if returning to filled step
      const nextStep = steps[nextIdx];
      if (nextStep) {
        const nextTask = tasks.find(t => t.id === nextStep.taskId) ?? null;
        initPendingFromTask(nextTask, nextStep.kind);
      }
    } else {
      setScreen('done');
    }
  }, [tasks, resetStepState, initPendingFromTask]);

  const goBack = useCallback((steps: ProcessingStep[], idx: number) => {
    if (idx > 0) {
      const prevIdx = idx - 1;
      setCurrentStepIndex(prevIdx);
      resetStepState();
      const prevStep = steps[prevIdx];
      if (prevStep) {
        const prevTask = tasks.find(t => t.id === prevStep.taskId) ?? null;
        initPendingFromTask(prevTask, prevStep.kind);
      }
    }
  }, [tasks, resetStepState, initPendingFromTask]);

  const startSession = useCallback(() => {
    const { sessionTaskIds: ids, allSteps: steps } = buildSession(tasks, projects, today);
    if (steps.length === 0) return;
    setSessionTaskIds(ids);
    setAllSteps(steps);
    setCurrentStepIndex(0);
    setCompletedSteps(new Set());
    resetStepState();
    // Pre-populate for first step
    const firstStep = steps[0];
    if (firstStep) {
      const firstTask = tasks.find(t => t.id === firstStep.taskId) ?? null;
      initPendingFromTask(firstTask, firstStep.kind);
    }
    setScreen('processing');
  }, [tasks, projects, today, resetStepState, initPendingFromTask]);

  const jumpToTask = useCallback((taskId: string, steps: ProcessingStep[]) => {
    const idx = steps.findIndex(s => s.taskId === taskId);
    if (idx !== -1) {
      setCurrentStepIndex(idx);
      resetStepState();
      const step = steps[idx];
      const task = tasks.find(t => t.id === taskId) ?? null;
      initPendingFromTask(task, step.kind);
    }
  }, [tasks, resetStepState, initPendingFromTask]);

  // Timer: reset when task changes
  useEffect(() => {
    if (screen !== 'processing' || !currentStep) return;
    if (timerTaskIdRef.current !== currentStep.taskId) {
      timerTaskIdRef.current = currentStep.taskId;
      setTimerSeconds(TIMER_DURATION);
    }
  }, [screen, currentStep?.taskId]);

  // Timer: countdown tick
  useEffect(() => {
    if (screen !== 'processing') return;
    const id = setInterval(() => {
      setTimerSeconds(s => {
        if (s <= 1) return 0;
        return s - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [screen]);

  // Auto-skip date step if the task's project has a future startDate
  useEffect(() => {
    if (screen !== 'processing' || !currentStep || currentStep.kind !== 'date' || !currentTask) return;
    const project = currentTask.projectId ? projects.find(p => p.id === currentTask.projectId) : null;
    if (project && isProjectStartInFuture(project, today)) {
      advanceStep(allSteps, currentStepIndex);
    }
  }, [screen, currentStep, currentTask, projects, today, advanceStep, allSteps, currentStepIndex]);

  // Mark current task as done
  const markTaskDone = useCallback((taskId: string, steps: ProcessingStep[], idx: number) => {
    onUpdateTask(taskId, { done: true }).then(() => {
      // Mark all steps for this task as completed
      setCompletedSteps(prev => {
        const next = new Set(prev);
        steps.filter(s => s.taskId === taskId).forEach(s => next.add(`${s.taskId}:${s.kind}`));
        return next;
      });
      // Advance to first step of next task (skip remaining steps of current task)
      const nextIdx = steps.findIndex((s, i) => i > idx && s.taskId !== taskId);
      if (nextIdx !== -1) {
        setCurrentStepIndex(nextIdx);
        resetStepState();
        const nextStep = steps[nextIdx];
        const nextTask = tasks.find(t => t.id === nextStep.taskId) ?? null;
        initPendingFromTask(nextTask, nextStep.kind);
      } else {
        setScreen('done');
      }
    });
  }, [onUpdateTask, tasks, resetStepState, initPendingFromTask]);

  const pickDate = useCallback((opt: DateOption) => {
    if (!currentStep) return;
    const updates: Partial<Task> = opt.isNext
      ? { isNext: true, plannedDate: null }
      : { plannedDate: opt.date as string, isNext: false };
    onUpdateTask(currentStep.taskId, updates).then(() => {
      markStepCompleted(currentStep.taskId, 'date');
      advanceStep(allSteps, currentStepIndex);
    });
  }, [currentStep, onUpdateTask, markStepCompleted, advanceStep, allSteps, currentStepIndex]);

  const handleCreateProject = useCallback(async (name: string, areaId: string, lifterId: string | null) => {
    if (!currentStep) return;
    const project = await onCreateProject(name, areaId, lifterId);
    await onUpdateTask(currentStep.taskId, { projectId: project.id });
    markStepCompleted(currentStep.taskId, 'project');
    advanceStep(allSteps, currentStepIndex);
  }, [currentStep, onCreateProject, onUpdateTask, markStepCompleted, advanceStep, allSteps, currentStepIndex]);

  const handleDeleteTask = useCallback(async () => {
    if (!currentStep) return;
    const taskId = currentStep.taskId;
    await onDeleteTask(taskId);
    setCompletedSteps(prev => {
      const next = new Set(prev);
      allSteps.filter(s => s.taskId === taskId).forEach(s => next.add(`${s.taskId}:${s.kind}`));
      return next;
    });
    const nextIdx = allSteps.findIndex((s, i) => i > currentStepIndex && s.taskId !== taskId);
    if (nextIdx !== -1) {
      setCurrentStepIndex(nextIdx);
      resetStepState();
      const nextStep = allSteps[nextIdx];
      const nextTask = tasks.find(t => t.id === nextStep.taskId) ?? null;
      initPendingFromTask(nextTask, nextStep.kind);
    } else {
      setScreen('done');
    }
  }, [currentStep, onDeleteTask, allSteps, currentStepIndex, tasks, resetStepState, initPendingFromTask]);

  const handleConvertToProject = useCallback(async (projectName: string, areaId: string, lifterId: string | null, subtaskNames: string[]) => {
    if (!currentStep) return;
    const taskId = currentStep.taskId;
    await onConvertToProject(taskId, projectName, areaId, lifterId, subtaskNames);
    setCompletedSteps(prev => {
      const next = new Set(prev);
      allSteps.filter(s => s.taskId === taskId).forEach(s => next.add(`${s.taskId}:${s.kind}`));
      return next;
    });
    const nextIdx = allSteps.findIndex((s, i) => i > currentStepIndex && s.taskId !== taskId);
    if (nextIdx !== -1) {
      setCurrentStepIndex(nextIdx);
      resetStepState();
      const nextStep = allSteps[nextIdx];
      const nextTask = tasks.find(t => t.id === nextStep.taskId) ?? null;
      initPendingFromTask(nextTask, nextStep.kind);
    } else {
      setScreen('done');
    }
  }, [currentStep, onConvertToProject, allSteps, currentStepIndex, tasks, resetStepState, initPendingFromTask]);

  // Scroll highlighted project into view
  useEffect(() => {
    if (screen !== 'processing' || currentStep?.kind !== 'project') return;
    const list = projectListRef.current;
    if (!list) return;
    const highlighted = list.querySelector('.highlighted') as HTMLElement | null;
    highlighted?.scrollIntoView({ block: 'nearest' });
  }, [projectCursorIndex, screen, currentStep]);

  // Auto-focus project input
  useEffect(() => {
    if (screen === 'processing' && currentStep?.kind === 'project') {
      setTimeout(() => projectInputRef.current?.focus(), 50);
    }
  }, [screen, currentStep?.kind, currentStepIndex]);

  // Keyboard handler
  useEffect(() => {
    if (screen === 'summary') {
      const handler = (e: KeyboardEvent) => {
        if (e.key === 'Enter' && !nothingToDo) {
          e.preventDefault();
          startSession();
        }
      };
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }

    if (screen !== 'processing') return;

    const handler = (e: KeyboardEvent) => {
      if (!currentStep) return;

      if (currentStep.kind === 'project') {
        if (projectPanelMode !== 'list') return;
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setProjectCursorIndex(i => Math.min(i + 1, filteredProjects.length - 1));
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setProjectCursorIndex(i => Math.max(i - 1, 0));
          return;
        }
        if (e.key === 'Enter') {
          e.preventDefault();
          const selected = filteredProjects[projectCursorIndex];
          if (selected) {
            onUpdateTask(currentStep.taskId, { projectId: selected.id }).then(() => {
              markStepCompleted(currentStep.taskId, 'project');
              advanceStep(allSteps, currentStepIndex);
            });
          }
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          advanceStep(allSteps, currentStepIndex);
          return;
        }
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          goBack(allSteps, currentStepIndex);
          return;
        }
        // 'd' — mark done (only when input is not the target)
        if (e.key === 'd' && (e.target as HTMLElement).tagName !== 'INPUT') {
          e.preventDefault();
          markTaskDone(currentStep.taskId, allSteps, currentStepIndex);
          return;
        }
        return;
      }

      // Duration, Context or Date step
      const tag = (e.target as HTMLElement).tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA') return;

      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goBack(allSteps, currentStepIndex);
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        advanceStep(allSteps, currentStepIndex);
        return;
      }
      if (e.key === 'd') {
        e.preventDefault();
        markTaskDone(currentStep.taskId, allSteps, currentStepIndex);
        return;
      }
      if (e.key === 'Enter') {
        e.preventDefault();
        if (pendingOptionKey === null) return;

        if (currentStep.kind === 'duration') {
          const opt = DURATION_OPTIONS.find(o => o.key === pendingOptionKey);
          if (opt) {
            onUpdateTask(currentStep.taskId, { duration: opt.value }).then(() => {
              markStepCompleted(currentStep.taskId, 'duration');
              advanceStep(allSteps, currentStepIndex);
            });
          }
        } else if (currentStep.kind === 'energy') {
          const opt = ENERGY_OPTIONS.find(o => o.key === pendingOptionKey);
          if (opt) {
            onUpdateTask(currentStep.taskId, { effort: opt.value }).then(() => {
              markStepCompleted(currentStep.taskId, 'energy');
              advanceStep(allSteps, currentStepIndex);
            });
          }
        } else if (currentStep.kind === 'context') {
          const idx = OPTION_KEYS.indexOf(pendingOptionKey);
          const ctx = contexts[idx];
          if (ctx) {
            onUpdateTask(currentStep.taskId, { contextId: ctx.id }).then(() => {
              markStepCompleted(currentStep.taskId, 'context');
              advanceStep(allSteps, currentStepIndex);
            });
          }
        } else if (currentStep.kind === 'date') {
          const opt = dateOptions.find(o => o.key === pendingOptionKey);
          if (opt) pickDate(opt);
        }
        return;
      }

      // Option key selection
      const lowerKey = e.key.toLowerCase();
      if (currentStep.kind === 'duration') {
        if (DURATION_OPTIONS.some(o => o.key === lowerKey)) {
          e.preventDefault();
          setPendingOptionKey(lowerKey);
        }
      } else if (currentStep.kind === 'energy') {
        if (ENERGY_OPTIONS.some(o => o.key === lowerKey)) {
          e.preventDefault();
          setPendingOptionKey(lowerKey);
        }
      } else if (currentStep.kind === 'context') {
        const idx = OPTION_KEYS.indexOf(lowerKey);
        if (idx >= 0 && idx < contexts.length) {
          e.preventDefault();
          setPendingOptionKey(lowerKey);
        }
      } else if (currentStep.kind === 'date') {
        if (lowerKey === '7') {
          e.preventDefault();
          setShowParser(true);
          setParserText('');
        } else if (dateOptions.some(o => o.key === lowerKey)) {
          e.preventDefault();
          setPendingOptionKey(lowerKey);
        }
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [
    screen, currentStep, currentStepIndex, allSteps,
    filteredProjects, projectCursorIndex, projectPanelMode, pendingOptionKey,
    contexts, dateOptions, nothingToDo, today,
    onUpdateTask, markStepCompleted, advanceStep, goBack, startSession, markTaskDone, pickDate,
  ]);

  // Reset project cursor when query changes
  useEffect(() => {
    setProjectCursorIndex(0);
  }, [projectQuery]);

  // ── Render ──────────────────────────────────────────────────────────────────

  if (screen === 'summary') {
    return (
      <div className="processing-view">
        <div className="proc-summary">
          {nothingToDo ? (
            <div className="proc-all-done">Wszystko gotowe, brak zadań do przetworzenia.</div>
          ) : (
            <>
              <div className="proc-summary-title">Do przetworzenia</div>
              <div className="proc-stats">
                <div className={`proc-stat-card${inboxCount === 0 ? ' zero' : ''}`}>
                  <div className="proc-stat-number">{inboxCount}</div>
                  <div className="proc-stat-label">Inbox</div>
                </div>
                <div className={`proc-stat-card${noDurationCount === 0 ? ' zero' : ''}`}>
                  <div className="proc-stat-number">{noDurationCount}</div>
                  <div className="proc-stat-label">Bez czasu</div>
                </div>
                <div className={`proc-stat-card${noEnergyCount === 0 ? ' zero' : ''}`}>
                  <div className="proc-stat-number">{noEnergyCount}</div>
                  <div className="proc-stat-label">Bez energii</div>
                </div>
                <div className={`proc-stat-card${noContextCount === 0 ? ' zero' : ''}`}>
                  <div className="proc-stat-number">{noContextCount}</div>
                  <div className="proc-stat-label">Bez kontekstu</div>
                </div>
                <div className={`proc-stat-card${noDateCount === 0 ? ' zero' : ''}`}>
                  <div className="proc-stat-number">{noDateCount}</div>
                  <div className="proc-stat-label">Bez daty</div>
                </div>
              </div>
              <button className="proc-start-btn" onClick={startSession}>
                Rozpocznij <kbd>↵</kbd>
              </button>
            </>
          )}
        </div>
      </div>
    );
  }

  if (screen === 'done') {
    const processedCount = new Set([...completedSteps].map(k => k.split(':')[0])).size;
    return (
      <div className="processing-view">
        <div className="proc-done">
          <div className="proc-done-icon">✓</div>
          <div className="proc-done-title">Przetworzono {processedCount} {processedCount === 1 ? 'zadanie' : processedCount < 5 ? 'zadania' : 'zadań'}</div>
          <button className="proc-start-btn" onClick={onNavigateToToday}>
            Przejdź do Dziś
          </button>
          <button className="proc-skip-btn" onClick={() => setScreen('summary')}>
            Wróć do podsumowania
          </button>
        </div>
      </div>
    );
  }

  // Processing screen
  if (!currentTask || !currentStep) return null;

  const taskStepsInSession = allSteps.filter(s => s.taskId === currentStep.taskId);
  const stepLabels: Record<ProcessingStepKind, string> = { project: 'Projekt', duration: 'Czas', energy: 'Energia', context: 'Kontekst', date: 'Data' };
  const stepTagLabels: Record<ProcessingStepKind, string> = { project: 'Inbox', duration: 'Czas', energy: 'Energia', context: 'Kontekst', date: 'Data' };

  const doneTaskCount = sessionTaskIds.filter(id => isTaskFullyProcessed(id, allSteps, completedSteps)).length;
  const progressPct = sessionTaskIds.length > 0 ? (doneTaskCount / sessionTaskIds.length) * 100 : 0;

  return (
    <div className="processing-view">
      <div className="proc-layout">
        {/* Sidebar */}
        <div className="proc-sidebar">
          <div className="proc-sidebar-head">
            <span className="proc-sidebar-label">Zadania w sesji</span>
            <span className="proc-sidebar-progress">
              <strong>{doneTaskCount}</strong> / {sessionTaskIds.length}
            </span>
          </div>
          <div className="proc-progress-bar">
            <div className="proc-progress-fill" style={{ width: `${progressPct}%` }} />
          </div>
          <div className="proc-sidebar-list">
            {sessionTaskIds.map((taskId, index) => {
              const task = tasks.find(t => t.id === taskId);
              if (!task) return null;
              const isCurrent = currentStep.taskId === taskId;
              const isDone = isTaskFullyProcessed(taskId, allSteps, completedSteps);
              const taskSteps = allSteps.filter(s => s.taskId === taskId);
              return (
                <div
                  key={taskId}
                  className={`proc-sidebar-item${isCurrent ? ' current' : ''}${isDone ? ' done' : ''}`}
                  onClick={() => jumpToTask(taskId, allSteps)}
                >
                  <span className="proc-sidebar-num">{String(index + 1).padStart(2, '0')}</span>
                  <div className="proc-sidebar-body">
                    <div className="proc-sidebar-name">{task.name}</div>
                    <div className="proc-sidebar-tags">
                      {taskSteps.map(step => {
                        const stepDone = completedSteps.has(`${taskId}:${step.kind}`);
                        return (
                          <span key={step.kind} className={`proc-sidebar-tag${stepDone ? ' done-tag' : ''}`}>
                            {stepDone ? '✓ ' : ''}{stepTagLabels[step.kind]}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                  {isDone && <span className="proc-sidebar-check">✓</span>}
                </div>
              );
            })}
          </div>
        </div>

        {/* Main area */}
        <div className="proc-main">
          {/* Timer + Done row */}
          <div className="proc-top-row">
            <TimerRing seconds={timerSeconds} total={TIMER_DURATION} />
            <div className="proc-top-actions">
              <button
                className="proc-done-btn"
                onClick={() => markTaskDone(currentStep.taskId, allSteps, currentStepIndex)}
                title="Oznacz jako zrobione (d)"
              >
                ✓ Zrobione <kbd>d</kbd>
              </button>
              <button
                className="proc-delete-btn"
                onClick={handleDeleteTask}
                title="Usuń zadanie"
              >
                Usuń
              </button>
            </div>
          </div>

          {/* Step indicator */}
          <div className="proc-step-indicator">
            {taskStepsInSession.map((step, i) => {
              const isActive = step.kind === currentStep.kind;
              const isDoneStep = completedSteps.has(`${step.taskId}:${step.kind}`);
              return (
                <span key={step.kind}>
                  {i > 0 && <span className="proc-step-sep">·</span>}
                  <span className={`proc-step-crumb${isActive ? ' active' : ''}${isDoneStep && !isActive ? ' done-step' : ''}`}>
                    {isDoneStep && !isActive ? '✓ ' : ''}{stepLabels[step.kind]}
                  </span>
                </span>
              );
            })}
          </div>

          {/* Task name */}
          <div className="proc-task-name">{currentTask.name}</div>

          {/* Task context breadcrumb */}
          {currentTask.projectId && (() => {
            const project = projects.find(p => p.id === currentTask.projectId);
            const area = project ? areas.find(a => a.id === project.areaId) : null;
            const lifter = project?.lifterId ? lifters.find(l => l.id === project.lifterId) : null;
            return (
              <div className="proc-task-breadcrumb">
                {area && <span className="proc-breadcrumb-area">{area.name}</span>}
                {lifter && <><span className="proc-breadcrumb-sep"> / </span><span className="proc-breadcrumb-lifter">{lifter.name}</span></>}
                {project && <><span className="proc-breadcrumb-sep"> / </span><span className="proc-breadcrumb-project">{project.name}</span></>}
              </div>
            );
          })()}

          <div className="proc-divider" />

          {/* Step panel */}
          {currentStep.kind === 'project' && (
            <ProjectStepPanel
              projects={filteredProjects}
              areas={areas}
              lifters={lifters}
              query={projectQuery}
              cursorIndex={projectCursorIndex}
              inputRef={projectInputRef}
              listRef={projectListRef}
              onQueryChange={setProjectQuery}
              onSelect={idx => setProjectCursorIndex(idx)}
              onConfirm={projectId => {
                onUpdateTask(currentStep.taskId, { projectId }).then(() => {
                  markStepCompleted(currentStep.taskId, 'project');
                  advanceStep(allSteps, currentStepIndex);
                });
              }}
              onSkip={() => advanceStep(allSteps, currentStepIndex)}
              onCreateProject={handleCreateProject}
              onConvertToProject={handleConvertToProject}
              onCreateLifter={onCreateLifter}
              taskName={currentTask.name}
              mode={projectPanelMode}
              onModeChange={setProjectPanelMode}
            />
          )}

          {currentStep.kind === 'duration' && (
            <OptionStepPanel
              options={DURATION_OPTIONS.map(o => ({ key: o.key, label: o.label, icon: null }))}
              pendingKey={pendingOptionKey}
              onSelect={setPendingOptionKey}
              onConfirm={() => {
                const opt = DURATION_OPTIONS.find(o => o.key === pendingOptionKey);
                if (opt) {
                  onUpdateTask(currentStep.taskId, { duration: opt.value }).then(() => {
                    markStepCompleted(currentStep.taskId, 'duration');
                    advanceStep(allSteps, currentStepIndex);
                  });
                }
              }}
              onSkip={() => advanceStep(allSteps, currentStepIndex)}
            />
          )}

          {currentStep.kind === 'energy' && (
            <EnergyStepPanel
              options={ENERGY_OPTIONS}
              pendingKey={pendingOptionKey}
              onSelect={setPendingOptionKey}
              onConfirm={() => {
                const opt = ENERGY_OPTIONS.find(o => o.key === pendingOptionKey);
                if (opt) {
                  onUpdateTask(currentStep.taskId, { effort: opt.value }).then(() => {
                    markStepCompleted(currentStep.taskId, 'energy');
                    advanceStep(allSteps, currentStepIndex);
                  });
                }
              }}
              onConfirmKey={key => {
                const opt = ENERGY_OPTIONS.find(o => o.key === key);
                if (opt) {
                  onUpdateTask(currentStep.taskId, { effort: opt.value }).then(() => {
                    markStepCompleted(currentStep.taskId, 'energy');
                    advanceStep(allSteps, currentStepIndex);
                  });
                }
              }}
              onSkip={() => advanceStep(allSteps, currentStepIndex)}
            />
          )}

          {currentStep.kind === 'context' && (
            <OptionStepPanel
              options={contexts.map((ctx, i) => ({ key: OPTION_KEYS[i] ?? '?', label: ctx.name, icon: ctx.icon }))}
              pendingKey={pendingOptionKey}
              onSelect={setPendingOptionKey}
              onConfirm={() => {
                const idx = OPTION_KEYS.indexOf(pendingOptionKey ?? '');
                const ctx = contexts[idx];
                if (ctx) {
                  onUpdateTask(currentStep.taskId, { contextId: ctx.id }).then(() => {
                    markStepCompleted(currentStep.taskId, 'context');
                    advanceStep(allSteps, currentStepIndex);
                  });
                }
              }}
              onSkip={() => advanceStep(allSteps, currentStepIndex)}
            />
          )}

          {currentStep.kind === 'date' && (
            <DateStepPanel
              options={dateOptions}
              pendingKey={pendingOptionKey}
              today={today}
              onSelect={setPendingOptionKey}
              onConfirm={() => {
                const opt = dateOptions.find(o => o.key === pendingOptionKey);
                if (opt && !opt.isCustom) pickDate(opt);
              }}
              onConfirmCustomDate={(date) => {
                if (!currentStep) return;
                onUpdateTask(currentStep.taskId, { plannedDate: date, isNext: false }).then(() => {
                  markStepCompleted(currentStep.taskId, 'date');
                  advanceStep(allSteps, currentStepIndex);
                });
              }}
              onSkip={() => advanceStep(allSteps, currentStepIndex)}
              showParser={showParser}
              parserText={parserText}
              onOpenParser={() => { setShowParser(true); setParserText(''); }}
              onParserTextChange={setParserText}
            />
          )}

          {/* Back / skip controls */}
          <div className="proc-controls">
            {currentStepIndex > 0 && (
              <button className="proc-back-btn" onClick={() => goBack(allSteps, currentStepIndex)}>
                ← Wstecz
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

type ProjectGroup = {
  areaId: string; areaName: string;
  lifterId: string | null; lifterName: string | null;
  items: Array<{ project: Project; flatIndex: number }>;
};

function buildProjectGroups(projects: Project[], areas: Area[], lifters: Lifter[]): ProjectGroup[] {
  const groups: ProjectGroup[] = [];
  projects.forEach((project, flatIndex) => {
    let group = groups.find(g => g.areaId === project.areaId && g.lifterId === project.lifterId);
    if (!group) {
      const area = areas.find(a => a.id === project.areaId);
      const lifter = project.lifterId ? lifters.find(l => l.id === project.lifterId) : null;
      group = { areaId: project.areaId, areaName: area?.name ?? '(brak)', lifterId: project.lifterId, lifterName: lifter?.name ?? null, items: [] };
      groups.push(group);
    }
    group.items.push({ project, flatIndex });
  });
  return groups;
}

interface ProjectStepPanelProps {
  projects: Project[];
  areas: Area[];
  lifters: Lifter[];
  query: string;
  cursorIndex: number;
  inputRef: React.RefObject<HTMLInputElement | null>;
  listRef: React.RefObject<HTMLDivElement | null>;
  onQueryChange: (q: string) => void;
  onSelect: (idx: number) => void;
  onConfirm: (projectId: string) => void;
  onSkip: () => void;
  onCreateProject: (name: string, areaId: string, lifterId: string | null) => Promise<void>;
  onConvertToProject: (projectName: string, areaId: string, lifterId: string | null, subtaskNames: string[]) => Promise<void>;
  onCreateLifter: (name: string, areaId: string) => Promise<Lifter>;
  taskName: string;
  mode: ProjectPanelMode;
  onModeChange: (mode: ProjectPanelMode) => void;
}

function ProjectStepPanel({ projects, areas, lifters, query, cursorIndex, inputRef, listRef, onQueryChange, onSelect, onConfirm, onSkip, onCreateProject, onConvertToProject, onCreateLifter, taskName, mode, onModeChange }: ProjectStepPanelProps) {
  const [newProjName, setNewProjName] = useState('');
  const [newProjAreaId, setNewProjAreaId] = useState('');
  const [newProjLifterId, setNewProjLifterId] = useState<string | null>(null);
  const [newProjCreatingLifter, setNewProjCreatingLifter] = useState(false);
  const [newProjNewLifterName, setNewProjNewLifterName] = useState('');
  const [convProjName, setConvProjName] = useState('');
  const [convAreaId, setConvAreaId] = useState('');
  const [convLifterId, setConvLifterId] = useState<string | null>(null);
  const [convCreatingLifter, setConvCreatingLifter] = useState(false);
  const [convNewLifterName, setConvNewLifterName] = useState('');
  const [convSubtasks, setConvSubtasks] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const groups = useMemo(() => buildProjectGroups(projects, areas, lifters), [projects, areas, lifters]);
  const showCreateOption = query.trim() !== '';

  const openNewProject = () => {
    setNewProjName(query);
    setNewProjAreaId(areas[0]?.id ?? '');
    setNewProjLifterId(null);
    onModeChange('new-project');
  };

  const openConvert = () => {
    setConvProjName(taskName);
    setConvAreaId(areas[0]?.id ?? '');
    setConvLifterId(null);
    setConvSubtasks('');
    onModeChange('convert');
  };

  const cancelForm = () => {
    onModeChange('list');
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const submitNewProject = async () => {
    if (!newProjName.trim() || !newProjAreaId || isSubmitting) return;
    setIsSubmitting(true);
    try {
      await onCreateProject(newProjName.trim(), newProjAreaId, newProjLifterId);
    } finally {
      setIsSubmitting(false);
    }
  };

  const submitConvert = async () => {
    if (!convProjName.trim() || !convAreaId || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const subtaskNames = convSubtasks.split('\n').map(s => s.trim()).filter(Boolean);
      await onConvertToProject(convProjName.trim(), convAreaId, convLifterId, subtaskNames);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (mode === 'new-project') {
    const areaLifters = lifters.filter(l => l.areaId === newProjAreaId);
    return (
      <div className="proc-project-step">
        <div className="proc-step-hint">Nowy projekt</div>
        <div className="proc-form">
          <input
            className="proc-project-search"
            placeholder="Nazwa projektu"
            value={newProjName}
            onChange={e => setNewProjName(e.target.value)}
            autoFocus
            onKeyDown={e => {
              if (e.key === 'Escape') { e.stopPropagation(); cancelForm(); }
              if (e.key === 'Enter') { e.stopPropagation(); submitNewProject(); }
            }}
          />
          <div className="proc-form-row">
            <label className="proc-form-label">Obszar</label>
            <select
              className="proc-form-select"
              value={newProjAreaId}
              onChange={e => { setNewProjAreaId(e.target.value); setNewProjLifterId(null); setNewProjCreatingLifter(false); setNewProjNewLifterName(''); }}
            >
              {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          {areaLifters.length > 0 && (
            <div className="proc-form-row">
              <label className="proc-form-label">Podobszar</label>
              <select
                className="proc-form-select"
                value={newProjLifterId ?? ''}
                onChange={e => setNewProjLifterId(e.target.value || null)}
              >
                <option value="">(brak)</option>
                {areaLifters.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          )}
          {newProjCreatingLifter ? (
            <div className="proc-form-row proc-form-row--new-lifter">
              <input
                className="proc-form-input"
                placeholder="Nazwa podobszaru"
                value={newProjNewLifterName}
                onChange={e => setNewProjNewLifterName(e.target.value)}
                autoFocus
                onKeyDown={async e => {
                  if (e.key === 'Escape') { e.stopPropagation(); setNewProjCreatingLifter(false); setNewProjNewLifterName(''); }
                  if (e.key === 'Enter' && newProjNewLifterName.trim()) {
                    e.stopPropagation();
                    const lifter = await onCreateLifter(newProjNewLifterName.trim(), newProjAreaId);
                    setNewProjLifterId(lifter.id);
                    setNewProjCreatingLifter(false);
                    setNewProjNewLifterName('');
                  }
                }}
              />
              <button
                className="proc-form-confirm proc-form-confirm--sm"
                disabled={!newProjNewLifterName.trim()}
                onClick={async () => {
                  const lifter = await onCreateLifter(newProjNewLifterName.trim(), newProjAreaId);
                  setNewProjLifterId(lifter.id);
                  setNewProjCreatingLifter(false);
                  setNewProjNewLifterName('');
                }}
              >Utwórz</button>
              <button className="proc-skip-btn" onClick={() => { setNewProjCreatingLifter(false); setNewProjNewLifterName(''); }}>Anuluj</button>
            </div>
          ) : (
            <button className="proc-new-lifter-btn" onClick={() => setNewProjCreatingLifter(true)}>+ Nowy podobszar</button>
          )}
          <div className="proc-form-actions">
            <button className="proc-form-confirm" onClick={submitNewProject} disabled={!newProjName.trim() || isSubmitting}>
              Utwórz projekt
            </button>
            <button className="proc-skip-btn" onClick={cancelForm}>Anuluj</button>
          </div>
        </div>
      </div>
    );
  }

  if (mode === 'convert') {
    const areaLifters = lifters.filter(l => l.areaId === convAreaId);
    return (
      <div className="proc-project-step">
        <div className="proc-step-hint">Zamień zadanie w projekt</div>
        <div className="proc-form">
          <input
            className="proc-project-search"
            placeholder="Nazwa projektu"
            value={convProjName}
            onChange={e => setConvProjName(e.target.value)}
            autoFocus
            onKeyDown={e => {
              if (e.key === 'Escape') { e.stopPropagation(); cancelForm(); }
            }}
          />
          <div className="proc-form-row">
            <label className="proc-form-label">Obszar</label>
            <select
              className="proc-form-select"
              value={convAreaId}
              onChange={e => { setConvAreaId(e.target.value); setConvLifterId(null); setConvCreatingLifter(false); setConvNewLifterName(''); }}
            >
              {areas.map(a => <option key={a.id} value={a.id}>{a.name}</option>)}
            </select>
          </div>
          {areaLifters.length > 0 && (
            <div className="proc-form-row">
              <label className="proc-form-label">Podobszar</label>
              <select
                className="proc-form-select"
                value={convLifterId ?? ''}
                onChange={e => setConvLifterId(e.target.value || null)}
              >
                <option value="">(brak)</option>
                {areaLifters.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
              </select>
            </div>
          )}
          {convCreatingLifter ? (
            <div className="proc-form-row proc-form-row--new-lifter">
              <input
                className="proc-form-input"
                placeholder="Nazwa podobszaru"
                value={convNewLifterName}
                onChange={e => setConvNewLifterName(e.target.value)}
                autoFocus
                onKeyDown={async e => {
                  if (e.key === 'Escape') { e.stopPropagation(); setConvCreatingLifter(false); setConvNewLifterName(''); }
                  if (e.key === 'Enter' && convNewLifterName.trim()) {
                    e.stopPropagation();
                    const lifter = await onCreateLifter(convNewLifterName.trim(), convAreaId);
                    setConvLifterId(lifter.id);
                    setConvCreatingLifter(false);
                    setConvNewLifterName('');
                  }
                }}
              />
              <button
                className="proc-form-confirm proc-form-confirm--sm"
                disabled={!convNewLifterName.trim()}
                onClick={async () => {
                  const lifter = await onCreateLifter(convNewLifterName.trim(), convAreaId);
                  setConvLifterId(lifter.id);
                  setConvCreatingLifter(false);
                  setConvNewLifterName('');
                }}
              >Utwórz</button>
              <button className="proc-skip-btn" onClick={() => { setConvCreatingLifter(false); setConvNewLifterName(''); }}>Anuluj</button>
            </div>
          ) : (
            <button className="proc-new-lifter-btn" onClick={() => setConvCreatingLifter(true)}>+ Nowy podobszar</button>
          )}
          <div className="proc-form-row proc-form-row--col">
            <label className="proc-form-label">Zadania projektu (jedno na linię)</label>
            <textarea
              className="proc-form-textarea"
              value={convSubtasks}
              onChange={e => setConvSubtasks(e.target.value)}
              placeholder={"Zamów materiały\nUmów hydraulika"}
              rows={4}
              onKeyDown={e => {
                if (e.key === 'Escape') { e.stopPropagation(); cancelForm(); }
              }}
            />
          </div>
          <div className="proc-form-actions">
            <button className="proc-form-confirm" onClick={submitConvert} disabled={!convProjName.trim() || isSubmitting}>
              Zamień w projekt
            </button>
            <button className="proc-skip-btn" onClick={cancelForm}>Anuluj</button>
          </div>
        </div>
      </div>
    );
  }

  // mode === 'list'
  return (
    <div className="proc-project-step">
      <div className="proc-step-hint">Wybierz projekt <kbd>↵</kbd> lub pomiń <kbd>Esc</kbd></div>
      <input
        ref={inputRef}
        className="proc-project-search"
        placeholder="Szukaj projektu…"
        value={query}
        onChange={e => onQueryChange(e.target.value)}
      />
      <div className="proc-project-list" ref={listRef}>
        {groups.length === 0 && !showCreateOption && (
          <div className="proc-project-empty">Brak projektów, wpisz inną frazę lub pomiń</div>
        )}
        {groups.map(group => (
          <div key={`${group.areaId}-${group.lifterId ?? ''}`} className="proc-project-group">
            <div className="proc-project-group-header">
              <span className="proc-group-area">{group.areaName}</span>
              {group.lifterName && <><span className="proc-group-sep"> / </span><span className="proc-group-lifter">{group.lifterName}</span></>}
            </div>
            {group.items.map(({ project, flatIndex }) => (
              <div
                key={project.id}
                className={`proc-project-option${flatIndex === cursorIndex ? ' highlighted' : ''}`}
                onMouseEnter={() => onSelect(flatIndex)}
                onClick={() => onConfirm(project.id)}
              >
                {project.name}
              </div>
            ))}
          </div>
        ))}
        {showCreateOption && (
          <div
            className="proc-project-create"
            onClick={() => openNewProject()}
          >
            + Stwórz projekt: „{query}"
          </div>
        )}
      </div>
      <div className="proc-project-bottom">
        <button className="proc-skip-btn" onClick={onSkip}>
          Pomiń, zostaw w Inbox <kbd>Esc</kbd>
        </button>
        <button className="proc-convert-btn" onClick={openConvert}>
          Zamień w projekt
        </button>
      </div>
    </div>
  );
}

interface OptionItem {
  key: string;
  label: string;
  icon: string | null;
}

interface OptionStepPanelProps {
  options: OptionItem[];
  pendingKey: string | null;
  onSelect: (key: string) => void;
  onConfirm: () => void;
  onSkip: () => void;
}

function OptionStepPanel({ options, pendingKey, onSelect, onConfirm, onSkip }: OptionStepPanelProps) {
  return (
    <div className="proc-option-step">
      <div className="proc-step-hint">Wybierz klawiszem lub klikiem, potwierdź <kbd>↵</kbd> · pomiń <kbd>Esc</kbd></div>
      <div className="proc-options-grid">
        {options.map(opt => (
          <button
            key={opt.key}
            className={`proc-option-card${pendingKey === opt.key ? ' highlighted' : ''}`}
            onMouseEnter={() => onSelect(opt.key)}
            onClick={() => {
              if (pendingKey === opt.key) {
                onConfirm();
              } else {
                onSelect(opt.key);
              }
            }}
          >
            {opt.icon && <span className="proc-option-icon">{opt.icon}</span>}
            <span className="proc-option-label">{opt.label}</span>
            <span className="proc-option-key">{opt.key}</span>
          </button>
        ))}
      </div>
      <button className="proc-skip-btn" onClick={onSkip}>
        Pomiń <kbd>Esc</kbd>
      </button>
    </div>
  );
}

// ── Energy step panel ─────────────────────────────────────────────────────────

interface EnergyStepPanelProps {
  options: typeof ENERGY_OPTIONS;
  pendingKey: string | null;
  onSelect: (key: string) => void;
  onConfirm: () => void;
  onConfirmKey: (key: string) => void;
  onSkip: () => void;
}


function EnergyStepPanel({ options, pendingKey, onSelect, onConfirmKey, onSkip }: EnergyStepPanelProps) {
  return (
    <div className="proc-option-step">
      <div className="proc-step-hint">Kliknij lub wybierz <kbd>1</kbd>–<kbd>3</kbd>, potwierdź <kbd>↵</kbd> · pomiń <kbd>Esc</kbd></div>
      <div className="proc-options-grid proc-energy-grid">
        {options.map(opt => {
          const isHighlighted = pendingKey === opt.key;
          return (
            <button
              key={opt.key}
              className={`proc-option-card proc-energy-card${isHighlighted ? ' highlighted' : ''}`}
              style={isHighlighted ? { borderColor: opt.color, background: opt.color + '14' } : undefined}
              onMouseEnter={() => onSelect(opt.key)}
              onClick={() => onConfirmKey(opt.key)}
            >
              <BatteryIcon bars={opt.value === 'low' ? 1 : opt.value === 'medium' ? 2 : 3} color={isHighlighted ? opt.color : 'var(--text-muted)'} />
              <span className="proc-option-label" style={isHighlighted ? { color: opt.color } : undefined}>{opt.label}</span>
              <span className="proc-option-key">{opt.key}</span>
            </button>
          );
        })}
      </div>
      <button className="proc-skip-btn" onClick={onSkip}>
        Pomiń <kbd>Esc</kbd>
      </button>
    </div>
  );
}

// ── Date step panel ───────────────────────────────────────────────────────────

type DateOption = DateOptionShared;
const getDateOptions = getDateOptionsShared;

interface DateStepPanelProps {
  options: DateOption[];
  pendingKey: string | null;
  today: string;
  onSelect: (key: string) => void;
  onConfirm: () => void;
  onConfirmCustomDate: (date: string) => void;
  onSkip: () => void;
  showParser: boolean;
  parserText: string;
  onOpenParser: () => void;
  onParserTextChange: (text: string) => void;
}

const NO_HINT_LABELS = new Set(['Dziś', 'Jutro', 'Weekend', 'Następny tydzień']);

function DateStepPanel({ options, pendingKey, today, onSelect, onConfirm, onConfirmCustomDate, onSkip, showParser, parserText, onOpenParser, onParserTextChange }: DateStepPanelProps) {
  const parserRef = useRef<HTMLInputElement>(null);
  const parsed = parseDateInput(parserText);

  useEffect(() => {
    if (showParser) parserRef.current?.focus();
  }, [showParser]);

  return (
    <div className="proc-option-step proc-date-step">
      <div className="proc-step-hint">Wybierz klawiszem lub klikiem, potwierdź <kbd>↵</kbd> · pomiń <kbd>Esc</kbd></div>
      <div className="proc-options-grid">
        {options.map(opt => {
          if (opt.isCustom) {
            if (showParser) {
              return (
                <div key="parser" className="proc-date-parser">
                  <input
                    ref={parserRef}
                    type="text"
                    className="proc-parser-input"
                    placeholder="RRRR MM DD"
                    value={parserText}
                    onChange={e => onParserTextChange(e.target.value)}
                    onKeyDown={e => {
                      e.stopPropagation();
                      if (e.key === 'Enter' && parsed) onConfirmCustomDate(parsed);
                      if (e.key === 'Escape') onParserTextChange('');
                    }}
                  />
                  {parsed && <span className="proc-parser-preview">{formatPlannedDate(parsed, today)}</span>}
                </div>
              );
            }
            return (
              <button
                key={opt.key}
                className={`proc-option-card${pendingKey === opt.key ? ' highlighted' : ''}`}
                onMouseEnter={() => onSelect(opt.key)}
                onClick={onOpenParser}
              >
                <span className="proc-option-label">{opt.label}</span>
                <span className="proc-option-key">{opt.key}</span>
              </button>
            );
          }
          const hint = opt.date && !NO_HINT_LABELS.has(opt.label) ? formatPlannedDate(opt.date, today) : null;
          return (
            <button
              key={opt.key}
              className={`proc-option-card${pendingKey === opt.key ? ' highlighted' : ''}${opt.isNext ? ' proc-option-next' : ''}`}
              onMouseEnter={() => onSelect(opt.key)}
              onClick={() => {
                if (pendingKey === opt.key) {
                  onConfirm();
                } else {
                  onSelect(opt.key);
                }
              }}
            >
              <span className="proc-option-label">{opt.label}</span>
              {hint && <span className="proc-option-date-hint">{hint}</span>}
              <span className="proc-option-key">{opt.key}</span>
            </button>
          );
        })}
      </div>
      <button className="proc-skip-btn" onClick={onSkip}>
        Pomiń <kbd>Esc</kbd>
      </button>
    </div>
  );
}

// ── Timer ring ────────────────────────────────────────────────────────────────

interface TimerRingProps {
  seconds: number;
  total: number;
}

function TimerRing({ seconds, total }: TimerRingProps) {
  const r = 18;
  const circ = 2 * Math.PI * r;
  const progress = seconds / total; // 1 = full, 0 = empty
  const offset = circ * (1 - progress);
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const timeStr = `${mins}:${String(secs).padStart(2, '0')}`;
  const urgent = seconds <= 30 && seconds > 0;
  const expired = seconds === 0;

  return (
    <div className={`proc-timer${urgent ? ' urgent' : ''}${expired ? ' expired' : ''}`}>
      <svg width="44" height="44" viewBox="0 0 44 44">
        <circle cx="22" cy="22" r={r} className="proc-timer-track" />
        <circle
          cx="22" cy="22" r={r}
          className="proc-timer-fill"
          strokeDasharray={circ}
          strokeDashoffset={offset}
          transform="rotate(-90 22 22)"
        />
      </svg>
      <span className="proc-timer-text">{timeStr}</span>
    </div>
  );
}
