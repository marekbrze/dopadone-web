import { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import type { Task, Project, Area, Lifter } from '../types';
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
  onClose: () => void;
}

type ReviewScreen = 'summary' | 'processing' | 'done';

interface TreeNode {
  project: Project;
  children: TreeNode[];
}

function buildProjectTree(projects: Project[], areaId: string): TreeNode[] {
  const areaProjects = projects.filter(p => p.areaId === areaId && !p.archived);
  const byId = new Map(areaProjects.map(p => [p.id, p]));

  function buildNode(project: Project): TreeNode {
    return {
      project,
      children: areaProjects
        .filter(p => p.parentProjectId === project.id)
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
        .map(buildNode),
    };
  }

  return areaProjects
    .filter(p => !p.parentProjectId || !byId.has(p.parentProjectId))
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map(buildNode);
}

function collectDescendantIds(node: TreeNode): string[] {
  return [node.project.id, ...node.children.flatMap(collectDescendantIds)];
}

function flattenTree(nodes: TreeNode[]): string[] {
  const result: string[] = [];
  for (const node of nodes) {
    result.push(node.project.id);
    result.push(...flattenTree(node.children));
  }
  return result;
}

function findNode(nodes: TreeNode[], id: string): TreeNode | null {
  for (const node of nodes) {
    if (node.project.id === id) return node;
    const found = findNode(node.children, id);
    if (found) return found;
  }
  return null;
}

export function ProjectReviewView({
  areaId, projects, tasks, areas, lifters,
  onArchiveProject, onDeleteProject, onUpdateTask, onAddTaskToProject, onClose,
}: ProjectReviewViewProps) {
  const [screen, setScreen] = useState<ReviewScreen>('summary');
  const [markedForArchive, setMarkedForArchive] = useState<Set<string>>(new Set());

  const [projectIds, setProjectIds] = useState<string[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [taskCursorIndex, setTaskCursorIndex] = useState(0);
  const [quickAddName, setQuickAddName] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [stats, setStats] = useState({ processed: 0, archived: 0, tasksMarkedDone: 0, tasksAdded: 0 });

  const quickAddRef = useRef<HTMLInputElement>(null);
  const taskListRef = useRef<HTMLDivElement>(null);

  const area = useMemo(() => areas.find(a => a.id === areaId), [areas, areaId]);
  const tree = useMemo(() => buildProjectTree(projects, areaId), [projects, areaId]);

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

  const parentProject = useMemo(() => {
    if (!currentProject) return null;
    return currentProject.parentProjectId ? projects.find(p => p.id === currentProject.parentProjectId) ?? null : null;
  }, [currentProject, projects]);

  // ── Summary screen helpers ──

  const toggleMark = useCallback((projectId: string) => {
    setMarkedForArchive(prev => {
      const next = new Set(prev);
      const node = findNode(tree, projectId);
      if (!node) return prev;
      const ids = collectDescendantIds(node);
      if (next.has(projectId)) {
        ids.forEach(id => next.delete(id));
      } else {
        ids.forEach(id => next.add(id));
      }
      return next;
    });
  }, [tree]);

  const handleStart = useCallback(async () => {
    for (const id of markedForArchive) {
      await onArchiveProject(id);
    }
    const archivedCount = markedForArchive.size;
    const remaining = flattenTree(tree).filter(id => !markedForArchive.has(id));

    if (remaining.length === 0) {
      setStats(s => ({ ...s, archived: archivedCount }));
      setScreen('done');
      return;
    }

    setProjectIds(remaining);
    setCurrentIndex(0);
    setTaskCursorIndex(0);
    setStats(s => ({ ...s, archived: archivedCount }));
    setScreen('processing');
  }, [markedForArchive, tree, onArchiveProject]);

  // ── Processing screen helpers ──

  const advanceProject = useCallback(() => {
    if (currentIndex < activeProjectIds.length - 1) {
      setCurrentIndex(i => i + 1);
      setTaskCursorIndex(0);
      setConfirmDelete(null);
    } else {
      setScreen('done');
    }
  }, [currentIndex, activeProjectIds.length]);

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
    advanceProject();
  }, [currentProjectId, onArchiveProject, advanceProject]);

  const handleSkip = useCallback(() => {
    setStats(s => ({ ...s, processed: s.processed + 1 }));
    advanceProject();
  }, [advanceProject]);

  const handleDeleteCurrent = useCallback(async () => {
    if (!currentProjectId) return;
    await onDeleteProject(currentProjectId);
    setConfirmDelete(null);
    setStats(s => ({ ...s, processed: s.processed + 1 }));
    advanceProject();
  }, [currentProjectId, onDeleteProject, advanceProject]);

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

  // Scroll highlighted task into view
  useEffect(() => {
    if (screen !== 'processing') return;
    const list = taskListRef.current;
    if (!list) return;
    const highlighted = list.querySelector('.pr-task-row.highlighted') as HTMLElement | null;
    highlighted?.scrollIntoView({ block: 'nearest' });
  }, [taskCursorIndex, screen]);

  // ── Keyboard handler ──

  useEffect(() => {
    if (screen === 'summary') {
      const handler = (e: KeyboardEvent) => {
        if (e.key === 'Enter') {
          e.preventDefault();
          handleStart();
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          onClose();
        }
      };
      window.addEventListener('keydown', handler);
      return () => window.removeEventListener('keydown', handler);
    }

    if (screen !== 'processing') return;

    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement).tagName;
      const inInput = tag === 'INPUT' || tag === 'TEXTAREA';

      // Quick-add input handling
      if (inInput) {
        if (e.key === 'Escape') {
          e.preventDefault();
          quickAddRef.current?.blur();
        }
        return;
      }

      // Delete confirmation
      if (confirmDelete) {
        if (e.key === 'Enter' || e.key === 'd') {
          e.preventDefault();
          handleDeleteCurrent();
          return;
        }
        if (e.key === 'Escape') {
          e.preventDefault();
          setConfirmDelete(null);
          return;
        }
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
      if (e.key === 'a') {
        e.preventDefault();
        quickAddRef.current?.focus();
        return;
      }
      if (e.key === 'e') {
        e.preventDefault();
        handleArchiveCurrent();
        return;
      }
      if (e.key === 'd') {
        e.preventDefault();
        if (currentProjectId) setConfirmDelete(currentProjectId);
        return;
      }
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        handleSkip();
        return;
      }
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goBackProject();
        return;
      }
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
        return;
      }
    };

    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [
    screen, projectTasks, taskCursorIndex, confirmDelete, currentProjectId,
    handleToggleTask, handleArchiveCurrent, handleDeleteCurrent, handleSkip,
    goBackProject, handleStart, onClose,
  ]);

  // ── Render ──

  if (screen === 'summary') {
    return (
      <div className="processing-view">
        <div className="proc-summary">
          <div className="proc-summary-title">Przegląd projektów — {area?.name ?? ''}</div>
          <div className="pr-project-list">
            <ProjectTreeRows
              nodes={tree}
              tasks={tasks}
              markedForArchive={markedForArchive}
              onToggle={toggleMark}
            />
          </div>
          {tree.length === 0 ? (
            <div className="proc-all-done">Brak aktywnych projektów w tym obszarze.</div>
          ) : (
            <div className="pr-summary-actions">
              <button className="proc-start-btn" onClick={handleStart}>
                Start <kbd>↵</kbd>
              </button>
              <button className="proc-skip-btn" onClick={onClose}>
                Anuluj <kbd>Esc</kbd>
              </button>
            </div>
          )}
        </div>
      </div>
    );
  }

  if (screen === 'done') {
    return (
      <div className="processing-view">
        <div className="proc-done">
          <div className="proc-done-icon">✓</div>
          <div className="proc-done-title">Przegląd zakończony</div>
          <div className="proc-stats">
            <div className="proc-stat-card">
              <div className="proc-stat-number">{stats.processed}</div>
              <div className="proc-stat-label">Przetworzono</div>
            </div>
            <div className="proc-stat-card">
              <div className="proc-stat-number">{stats.archived}</div>
              <div className="proc-stat-label">Zarchiwizowano</div>
            </div>
            <div className="proc-stat-card">
              <div className="proc-stat-number">{stats.tasksMarkedDone}</div>
              <div className="proc-stat-label">Zadania done</div>
            </div>
            <div className="proc-stat-card">
              <div className="proc-stat-number">{stats.tasksAdded}</div>
              <div className="proc-stat-label">Dodane zadania</div>
            </div>
          </div>
          <button className="proc-start-btn" onClick={onClose}>
            Zamknij
          </button>
        </div>
      </div>
    );
  }

  // Processing screen
  if (!currentProject) {
    return (
      <div className="processing-view">
        <div className="proc-done">
          <div className="proc-done-icon">✓</div>
          <div className="proc-done-title">Wszystkie projekty przetworzone</div>
          <button className="proc-start-btn" onClick={onClose}>Zamknij</button>
        </div>
      </div>
    );
  }

  const progressPct = activeProjectIds.length > 0 ? ((currentIndex + 1) / activeProjectIds.length) * 100 : 0;

  return (
    <div className="processing-view">
      <div className="pr-layout">
        {/* Progress bar */}
        <div className="pr-top-bar">
          <div className="pr-breadcrumb">
            {area && <span className="pr-breadcrumb-area">{area.name}</span>}
            {lifter && <><span className="pr-breadcrumb-sep"> / </span><span>{lifter.name}</span></>}
            {parentProject && <><span className="pr-breadcrumb-sep"> / </span><span>{parentProject.name}</span></>}
          </div>
          <div className="pr-progress-info">
            {currentIndex + 1} / {activeProjectIds.length}
          </div>
          <button className="pr-close-btn" onClick={onClose} title="Zamknij">✕</button>
        </div>
        <div className="proc-progress-bar">
          <div className="proc-progress-fill" style={{ width: `${progressPct}%` }} />
        </div>

        {/* Project name */}
        <div className="proc-task-name">{currentProject.name}</div>

        {/* All-done badge */}
        {allDone && (
          <div className="pr-all-done-hint">
            Wszystkie zadania zrobione — rozważ archiwizację <kbd>e</kbd>
          </div>
        )}

        <div className="pr-divider" />

        {/* Task list */}
        <div className="pr-task-list" ref={taskListRef}>
          {projectTasks.length === 0 && (
            <div className="pr-empty-tasks">Brak zadań</div>
          )}
          {projectTasks.map((task, i) => (
            <div
              key={task.id}
              className={`pr-task-row${i === taskCursorIndex ? ' highlighted' : ''}${task.done ? ' done-task' : ''}`}
              onClick={() => { setTaskCursorIndex(i); handleToggleTask(task); }}
              onMouseEnter={() => setTaskCursorIndex(i)}
            >
              <input
                type="checkbox"
                checked={task.done}
                onChange={() => handleToggleTask(task)}
                onClick={e => e.stopPropagation()}
              />
              <span className="pr-task-name">{task.name}</span>
            </div>
          ))}
        </div>

        {/* Quick-add */}
        <div className="pr-quick-add">
          <input
            ref={quickAddRef}
            type="text"
            placeholder="Dodaj zadanie… (a)"
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

        {/* Delete confirmation */}
        {confirmDelete && (
          <div className="pr-confirm-inline">
            <span>Usunąć projekt i wszystkie zadania?</span>
            <button className="pr-confirm-yes" onClick={handleDeleteCurrent}>Usuń <kbd>↵</kbd></button>
            <button className="pr-confirm-no" onClick={() => setConfirmDelete(null)}>Anuluj <kbd>Esc</kbd></button>
          </div>
        )}

        {/* Action bar */}
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

// ── Sub-component: Summary tree rows ──

interface ProjectTreeRowsProps {
  nodes: TreeNode[];
  tasks: Task[];
  markedForArchive: Set<string>;
  onToggle: (id: string) => void;
  depth?: number;
}

function ProjectTreeRows({ nodes, tasks, markedForArchive, onToggle, depth = 0 }: ProjectTreeRowsProps) {
  return (
    <>
      {nodes.map(node => {
        const projectTasks = tasks.filter(t => t.projectId === node.project.id);
        const doneCount = projectTasks.filter(t => t.done).length;
        const totalCount = projectTasks.length;
        const isMarked = markedForArchive.has(node.project.id);

        return (
          <div key={node.project.id}>
            <div
              className={`pr-project-row${isMarked ? ' marked' : ''}`}
              style={{ paddingLeft: `${depth * 24 + 12}px` }}
              onClick={() => onToggle(node.project.id)}
            >
              <span className={`pr-checkbox${isMarked ? ' checked' : ''}`}>
                {isMarked ? '☑' : '☐'}
              </span>
              <span className="pr-project-name">{node.project.name}</span>
              <span className="pr-task-count">{doneCount}/{totalCount}</span>
            </div>
            {node.children.length > 0 && (
              <ProjectTreeRows
                nodes={node.children}
                tasks={tasks}
                markedForArchive={markedForArchive}
                onToggle={onToggle}
                depth={depth + 1}
              />
            )}
          </div>
        );
      })}
    </>
  );
}
