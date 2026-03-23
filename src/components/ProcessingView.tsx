import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { Task, Project, Context, TaskDuration } from '../types';
import './ProcessingView.css';

interface ProcessingViewProps {
  tasks: Task[];
  projects: Project[];
  contexts: Context[];
  onUpdateTask: (id: string, updates: Partial<Task>) => Promise<void>;
}

type ProcessingStepKind = 'project' | 'duration' | 'context';
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

const OPTION_KEYS = ['1','2','3','4','5','6','7','8','9','0','a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t'];

function buildSession(tasks: Task[]): { sessionTaskIds: string[]; allSteps: ProcessingStep[] } {
  const eligible = tasks.filter(t =>
    !t.done && (t.projectId === null || t.duration == null || t.contextId === null)
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
    if (task.contextId === null) allSteps.push({ taskId: task.id, kind: 'context' });
  }

  return { sessionTaskIds, allSteps };
}

function durationKeyForValue(value: TaskDuration | null | undefined): string | null {
  if (value == null) return null;
  return DURATION_OPTIONS.find(o => o.value === value)?.key ?? null;
}

function contextKeyForId(contextId: string | null | undefined, contexts: Context[]): string | null {
  if (!contextId) return null;
  const idx = contexts.findIndex(c => c.id === contextId);
  return idx >= 0 ? (OPTION_KEYS[idx] ?? null) : null;
}

export function ProcessingView({ tasks, projects, contexts, onUpdateTask }: ProcessingViewProps) {
  const [screen, setScreen] = useState<ProcessingScreen>('summary');
  const [sessionTaskIds, setSessionTaskIds] = useState<string[]>([]);
  const [allSteps, setAllSteps] = useState<ProcessingStep[]>([]);
  const [currentStepIndex, setCurrentStepIndex] = useState(0);
  const [completedSteps, setCompletedSteps] = useState<Set<string>>(new Set());

  // Project step state
  const [projectQuery, setProjectQuery] = useState('');
  const [projectCursorIndex, setProjectCursorIndex] = useState(0);

  // Duration / Context step state
  const [pendingOptionKey, setPendingOptionKey] = useState<string | null>(null);

  const projectInputRef = useRef<HTMLInputElement>(null);
  const projectListRef = useRef<HTMLDivElement>(null);

  // Summary stats (live from props)
  const inboxCount = useMemo(() => tasks.filter(t => !t.done && t.projectId === null).length, [tasks]);
  const noDurationCount = useMemo(() => tasks.filter(t => !t.done && t.duration == null).length, [tasks]);
  const noContextCount = useMemo(() => tasks.filter(t => !t.done && t.contextId === null).length, [tasks]);
  const nothingToDo = inboxCount === 0 && noDurationCount === 0 && noContextCount === 0;

  const currentStep = allSteps[currentStepIndex] ?? null;
  const currentTask = useMemo(
    () => currentStep ? tasks.find(t => t.id === currentStep.taskId) ?? null : null,
    [currentStep, tasks]
  );

  // Filtered projects for project step
  const filteredProjects = useMemo(() => {
    if (!projectQuery.trim()) return projects;
    return projects.filter(p => p.name.toLowerCase().includes(projectQuery.toLowerCase()));
  }, [projects, projectQuery]);

  const resetStepState = useCallback(() => {
    setProjectQuery('');
    setProjectCursorIndex(0);
    setPendingOptionKey(null);
  }, []);

  const initPendingFromTask = useCallback((task: Task | null, kind: ProcessingStepKind) => {
    if (!task) return;
    if (kind === 'duration') {
      setPendingOptionKey(durationKeyForValue(task.duration));
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
    const { sessionTaskIds: ids, allSteps: steps } = buildSession(tasks);
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
  }, [tasks, resetStepState, initPendingFromTask]);

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
        return;
      }

      // Duration or Context step
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
        } else if (currentStep.kind === 'context') {
          const idx = OPTION_KEYS.indexOf(pendingOptionKey);
          const ctx = contexts[idx];
          if (ctx) {
            onUpdateTask(currentStep.taskId, { contextId: ctx.id }).then(() => {
              markStepCompleted(currentStep.taskId, 'context');
              advanceStep(allSteps, currentStepIndex);
            });
          }
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
      } else if (currentStep.kind === 'context') {
        const idx = OPTION_KEYS.indexOf(lowerKey);
        if (idx >= 0 && idx < contexts.length) {
          e.preventDefault();
          setPendingOptionKey(lowerKey);
        }
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [
    screen, currentStep, currentStepIndex, allSteps,
    filteredProjects, projectCursorIndex, pendingOptionKey,
    contexts, nothingToDo,
    onUpdateTask, markStepCompleted, advanceStep, goBack, startSession,
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
            <div className="proc-all-done">Wszystko gotowe — brak zadań do przetworzenia.</div>
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
                <div className={`proc-stat-card${noContextCount === 0 ? ' zero' : ''}`}>
                  <div className="proc-stat-number">{noContextCount}</div>
                  <div className="proc-stat-label">Bez kontekstu</div>
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
          <button className="proc-start-btn" onClick={() => setScreen('summary')}>
            Wróć do podsumowania
          </button>
        </div>
      </div>
    );
  }

  // Processing screen
  if (!currentTask || !currentStep) return null;

  const taskStepsInSession = allSteps.filter(s => s.taskId === currentStep.taskId);
  const stepLabels: Record<ProcessingStepKind, string> = { project: 'Projekt', duration: 'Czas', context: 'Kontekst' };
  const stepTagLabels: Record<ProcessingStepKind, string> = { project: 'Inbox', duration: 'Czas', context: 'Kontekst' };

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

          <div className="proc-divider" />

          {/* Step panel */}
          {currentStep.kind === 'project' && (
            <ProjectStepPanel
              projects={filteredProjects}
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

interface ProjectStepPanelProps {
  projects: Project[];
  query: string;
  cursorIndex: number;
  inputRef: React.RefObject<HTMLInputElement | null>;
  listRef: React.RefObject<HTMLDivElement | null>;
  onQueryChange: (q: string) => void;
  onSelect: (idx: number) => void;
  onConfirm: (projectId: string) => void;
  onSkip: () => void;
}

function ProjectStepPanel({ projects, query, cursorIndex, inputRef, listRef, onQueryChange, onSelect, onConfirm, onSkip }: ProjectStepPanelProps) {
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
        {projects.map((p, i) => (
          <div
            key={p.id}
            className={`proc-project-option${i === cursorIndex ? ' highlighted' : ''}`}
            onMouseEnter={() => onSelect(i)}
            onMouseDown={e => { e.preventDefault(); onConfirm(p.id); }}
          >
            {p.name}
          </div>
        ))}
        {projects.length === 0 && (
          <div className="proc-project-empty">Brak projektów — wpisz inną frazę lub pomiń</div>
        )}
      </div>
      <button className="proc-skip-btn" onClick={onSkip}>
        Pomiń — zostaw w Inbox <kbd>Esc</kbd>
      </button>
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
