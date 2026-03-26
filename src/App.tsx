import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { liveQuery } from 'dexie';
import type { AppState, Area, Lifter, Project, Task, Context, WorkBlock, CalendarEvent, DragPayload, ProjectNote, BlockTemplate } from './types';
import { loadData, queryAllData, isNewUser, seedFromOnboarding } from './data';
import { OnboardingWizard, SpotlightTour } from './components/OnboardingWizard';
import type { OnboardingResult } from './components/OnboardingWizard';
import { db } from './db';
import { AddItemModal } from './components/AddItemModal';
import { ProjectTree } from './components/ProjectTree';
import { SettingsModal } from './components/SettingsModal';
import { TaskDetailPanel } from './components/TaskDetailPanel';
import { RowMenuButton } from './components/RowMenuButton';
import { ItemDetailPanel } from './components/ItemDetailPanel';
import { ProjectDetailPanel } from './components/ProjectDetailPanel';
import { DoingView } from './components/DoingView';
import { AgendaView } from './components/AgendaView';
import { TodayView } from './components/TodayView';
import { InboxView } from './components/InboxView';
import { ProcessingView } from './components/ProcessingView';
import { ProjectNotesPanel } from './components/ProjectNotesPanel';
import { saveAutoBackup } from './utils/dataPortability';
import { completeMigrationIfPending } from './utils/cloudMigration';
import { isCloudSchema } from './db';
import './App.css';

function newId() {
  return crypto.randomUUID();
}

const priorityColors: Record<Task['priority'], string> = {
  low: '#5a7a5e',
  medium: '#a07830',
  high: '#a33a2a',
};

export default function App() {
  const [data, setData] = useState<AppState | null>(null);
  const [selectedAreaId, setSelectedAreaId] = useState<string>('');
  const [selectedLifterId, setSelectedLifterId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [projectTab, setProjectTab] = useState<'tasks' | 'notes'>('tasks');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [editingLifterId, setEditingLifterId] = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [modal, setModal] = useState<null | 'area' | 'lifter' | 'project' | 'subproject' | 'settings' | 'inbox-add'>(null);
  const [expandedColumns, setExpandedColumns] = useState<Set<string>>(new Set(['lifters']));
  const [showPlanDone, setShowPlanDone] = useState(false);
  const [currentView, setCurrentView] = useState<'today' | 'plan' | 'do' | 'agenda' | 'inbox' | 'processing'>('today');
  const [mobileNavOpen, setMobileNavOpen] = useState(false);
  const [dragPayload, setDragPayload] = useState<DragPayload | null>(null);
  const [dropTargetProjectId, setDropTargetProjectId] = useState<string | null>(null);
  const [dropTargetLifterId, setDropTargetLifterId] = useState<string | null>(null);
  const [dropTargetRootZone, setDropTargetRootZone] = useState(false);
  const [dropGapTarget, setDropGapTarget] = useState<{ parentProjectId: string | null; insertAfterProjectId: string | null } | null>(null);
  const [dropTaskGapTarget, setDropTaskGapTarget] = useState<string | null | undefined>(undefined);
  const [quickAddTaskName, setQuickAddTaskName] = useState('');
  const prevAreasCount = useRef(0);
  const [showOnboarding, setShowOnboarding] = useState(false);
  const [blockTemplates, setBlockTemplates] = useState<BlockTemplate[]>(() => {
    try { return JSON.parse(localStorage.getItem('dopadone-block-templates') ?? '[]'); } catch { return []; }
  });
  const [showTour, setShowTour] = useState(false);
  const [dataInitialized, setDataInitialized] = useState(false);

  const applyInitialData = useCallback((d: AppState) => {
    setData(d);
    const firstArea = d.areas[0];
    const areaId = firstArea?.id ?? '';
    setSelectedAreaId(areaId);
    const firstLifter = d.lifters.find(l => l.areaId === areaId);
    const lifterId = firstLifter?.id ?? null;
    setSelectedLifterId(lifterId);
    const firstProject = d.projects.find(p =>
      p.areaId === areaId && p.lifterId === lifterId && p.parentProjectId === null
    );
    setSelectedProjectId(firstProject?.id ?? null);
  }, []);

  const toggleColumn = (id: string) => {
    setExpandedColumns(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleColumnKeydown = (e: React.KeyboardEvent, id: string) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleColumn(id);
    }
  };

  useEffect(() => {
    completeMigrationIfPending()
      .then(() => isNewUser())
      .then(newUser => {
        if (newUser) {
          setShowOnboarding(true);
          return;
        }
        return loadData().then(d => {
          prevAreasCount.current = d.areas.length;
          applyInitialData(d);
          setDataInitialized(true);
        });
      })
      .catch(err => {
        console.error('Failed to load data:', err);
        applyInitialData({ areas: [], lifters: [], projects: [], tasks: [], contexts: [], workBlocks: [], events: [], projectNotes: [] });
        setDataInitialized(true);
      });
  }, [applyInitialData]);

  useEffect(() => { setShowPlanDone(false); }, [selectedProjectId]);

  // Subscribe to live updates (e.g. from Dexie Cloud sync) — starts after data is ready
  useEffect(() => {
    if (!dataInitialized) return;
    const subscription = liveQuery(() => queryAllData()).subscribe({
      next: (updated) => {
        const wasEmpty = prevAreasCount.current === 0 && updated.areas.length > 0;
        prevAreasCount.current = updated.areas.length;
        if (wasEmpty) {
          applyInitialData(updated);
        } else {
          setData(updated);
        }
      },
      error: (err) => console.error('liveQuery error:', err),
    });
    return () => subscription.unsubscribe();
  }, [dataInitialized, applyInitialData]);

  const handleOnboardingComplete = useCallback(async (result: OnboardingResult) => {
    try {
      await seedFromOnboarding(result.areas, result.contexts);
      if (result.firstProject?.name) {
        const areaRec = await db.areas.where('name').equals(result.firstProject.areaName).first();
        if (areaRec) {
          await db.projects.add({
            id: crypto.randomUUID(),
            name: result.firstProject.name,
            areaId: areaRec.id,
            lifterId: null,
            parentProjectId: null,
            order: 0,
          });
        }
      }
      const d = await queryAllData();
      prevAreasCount.current = d.areas.length;
      applyInitialData(d);
    } catch (err) {
      console.error('Onboarding seeding failed:', err);
      localStorage.setItem('dopadone-onboarding-complete', 'true');
      const d = await loadData();
      prevAreasCount.current = d.areas.length;
      applyInitialData(d);
    }
    setShowOnboarding(false);
    setDataInitialized(true);
    if (localStorage.getItem('dopadone-tour-complete') !== 'true') {
      setShowTour(true);
    }
  }, [applyInitialData]);

  const handleOnboardingSkip = useCallback(async () => {
    localStorage.setItem('dopadone-onboarding-complete', 'true');
    const d = await loadData();
    prevAreasCount.current = d.areas.length;
    applyInitialData(d);
    setShowOnboarding(false);
    setDataInitialized(true);
  }, [applyInitialData]);

  useEffect(() => {
    const BACKUP_INTERVAL = 5 * 60 * 1000;

    const interval = setInterval(async () => {
      try {
        await saveAutoBackup(db);
      } catch (err) {
        console.warn('Auto-backup failed:', err);
      }
    }, BACKUP_INTERVAL);

    const handleUnload = () => saveAutoBackup(db);
    window.addEventListener('beforeunload', handleUnload);

    return () => {
      clearInterval(interval);
      window.removeEventListener('beforeunload', handleUnload);
    };
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.code === 'Space') {
        e.preventDefault();
        setModal('inbox-add');
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // All hooks must be called before any early returns (Rules of Hooks)
  const lifters = useMemo(
    () => data ? data.lifters.filter(l => l.areaId === selectedAreaId) : [],
    [data, selectedAreaId]
  );

  const visibleProjects = useMemo(
    () => data
      ? data.projects
          .filter(p => {
            if (p.archived) return false;
            if (p.areaId !== selectedAreaId) return false;
            if (selectedLifterId) return p.lifterId === selectedLifterId;
            return true;
          })
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
      : [],
    [data, selectedAreaId, selectedLifterId]
  );

  const rootProjects = useMemo(() => {
    const visibleIds = new Set(visibleProjects.map(p => p.id));
    return visibleProjects.filter(p =>
      p.parentProjectId === null || !visibleIds.has(p.parentProjectId)
    );
  }, [visibleProjects]);

  const tasks = useMemo(
    () => (data && selectedProjectId) ? data.tasks.filter(t => t.projectId === selectedProjectId) : [],
    [data, selectedProjectId]
  );

  const undoneTasks = useMemo(() => tasks.filter(t => !t.done).sort((a, b) => (a.order ?? 0) - (b.order ?? 0)), [tasks]);
  const doneTasks = useMemo(() => tasks.filter(t => t.done), [tasks]);

  const projectNotes = useMemo(
    () => (data && selectedProjectId) ? (data.projectNotes ?? []).filter(n => n.projectId === selectedProjectId) : [],
    [data, selectedProjectId]
  );

  const selectedTask = useMemo(
    () => tasks.find(t => t.id === selectedTaskId) ?? null,
    [tasks, selectedTaskId]
  );

  const selectedArea = useMemo(
    () => data ? data.areas.find(a => a.id === selectedAreaId) : undefined,
    [data, selectedAreaId]
  );

  const inboxTaskCount = useMemo(
    () => data ? data.tasks.filter(t => !t.done && t.projectId === null).length : 0,
    [data]
  );

  const processingBadgeCount = useMemo(
    () => data ? data.tasks.filter(t => !t.done && (t.projectId === null || t.duration == null || t.contextId === null)).length : 0,
    [data]
  );

  const contextsMap = useMemo(
    () => data ? new Map(data.contexts.map(c => [c.id, c])) : new Map(),
    [data]
  );

  if (showOnboarding) {
    return (
      <OnboardingWizard
        onComplete={handleOnboardingComplete}
        onSkip={handleOnboardingSkip}
      />
    );
  }

  if (!data) {
    return (
      <div className="app" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
        <div style={{ opacity: 0.5, fontStyle: 'italic' }}>Ładowanie…</div>
      </div>
    );
  }

  const selectArea = (id: string) => {
    setSelectedAreaId(id);
    const firstLifter = data.lifters.find(l => l.areaId === id);
    const lifterId = firstLifter?.id ?? null;
    setSelectedLifterId(lifterId);
    const firstProject = data.projects.find(p =>
      p.areaId === id && p.lifterId === lifterId && p.parentProjectId === null
    );
    setSelectedProjectId(firstProject?.id ?? null);
    setSelectedTaskId(null);
    setEditingLifterId(null);
    setEditingProjectId(null);
  };

  const selectLifter = (id: string) => {
    setSelectedLifterId(id);
    const firstProject = data.projects.find(p =>
      p.areaId === selectedAreaId && p.lifterId === id && p.parentProjectId === null
    );
    setSelectedProjectId(firstProject?.id ?? null);
    setSelectedTaskId(null);
    setEditingLifterId(null);
    setEditingProjectId(null);
  };

  const selectTask = (id: string) => {
    setSelectedTaskId(prev => prev === id ? null : id);
    setEditingLifterId(null);
    setEditingProjectId(null);
  };

  // Area / lifter / project
  const addArea = async (name: string) => {
    const colors = ['#5c4a38', '#4a6852', '#6b5230', '#4a5c68', '#7a5c48'];
    const color = colors[data.areas.length % colors.length];
    const order = data.areas.length;
    let area: Area;
    if (isCloudSchema()) {
      const id = await db.areas.add({ name, color, order }) as string;
      area = { id, name, color, order };
    } else {
      area = { id: newId(), name, color, order };
      await db.areas.put(area);
    }
  };

  const addLifter = async (name: string) => {
    let lifter: Lifter;
    if (isCloudSchema()) {
      const id = await db.lifters.add({ name, areaId: selectedAreaId }) as string;
      lifter = { id, name, areaId: selectedAreaId };
    } else {
      lifter = { id: newId(), name, areaId: selectedAreaId };
      await db.lifters.put(lifter);
    }
  };

  const addProject = async (name: string, parentProjectId: string | null = null) => {
    const siblings = data.projects.filter(p => p.parentProjectId === parentProjectId && p.areaId === selectedAreaId);
    const order = siblings.length > 0 ? Math.max(...siblings.map(p => p.order ?? 0)) + 1 : 0;
    let proj: Project;
    if (isCloudSchema()) {
      const id = await db.projects.add({ name, areaId: selectedAreaId, lifterId: selectedLifterId, parentProjectId, order }) as string;
      proj = { id, name, areaId: selectedAreaId, lifterId: selectedLifterId, parentProjectId, order };
    } else {
      proj = { id: newId(), name, areaId: selectedAreaId, lifterId: selectedLifterId, parentProjectId, order };
      await db.projects.put(proj);
    }
  };

  const addProjectForProcessing = async (name: string, areaId: string, lifterId: string | null): Promise<Project> => {
    const siblings = data.projects.filter(p => p.parentProjectId === null && p.areaId === areaId);
    const order = siblings.length > 0 ? Math.max(...siblings.map(p => p.order ?? 0)) + 1 : 0;
    let proj: Project;
    if (isCloudSchema()) {
      const id = await db.projects.add({ name, areaId, lifterId, parentProjectId: null, order }) as string;
      proj = { id, name, areaId, lifterId, parentProjectId: null, order };
    } else {
      proj = { id: newId(), name, areaId, lifterId, parentProjectId: null, order };
      await db.projects.put(proj);
    }
    return proj;
  };

  const convertTaskToProject = async (taskId: string, projectName: string, areaId: string, lifterId: string | null, subtaskNames: string[]) => {
    const project = await addProjectForProcessing(projectName, areaId, lifterId);
    for (const name of subtaskNames) {
      if (isCloudSchema()) {
        await db.tasks.add({ name, projectId: project.id, done: false, priority: 'medium' as const, notes: '', effort: null, contextId: null, blocking: false, duration: null });
      } else {
        const task: Task = { id: newId(), name, projectId: project.id, done: false, priority: 'medium', notes: '', effort: null, contextId: null, blocking: false, duration: null };
        await db.tasks.put(task);
      }
    }
    await db.tasks.delete(taskId);
  };

  // Tasks
  const addTask = async (name: string) => {
    if (!selectedProjectId) return;
    const projectTasks = data?.tasks.filter(t => t.projectId === selectedProjectId) ?? [];
    const order = projectTasks.length > 0 ? Math.max(...projectTasks.map(t => t.order ?? 0)) + 1 : 0;
    let task: Task;
    if (isCloudSchema()) {
      const id = await db.tasks.add({ name, projectId: selectedProjectId, done: false, priority: 'medium', notes: '', effort: null, contextId: null, blocking: false, duration: null, order }) as string;
      task = { id, name, projectId: selectedProjectId, done: false, priority: 'medium', notes: '', effort: null, contextId: null, blocking: false, duration: null, order };
    } else {
      task = { id: newId(), name, projectId: selectedProjectId, done: false, priority: 'medium', notes: '', effort: null, contextId: null, blocking: false, duration: null, order };
      await db.tasks.put(task);
    }
    setData(d => d ? ({ ...d, tasks: [...d.tasks, task] }) : d);
  };

  const addInboxTask = async (name: string): Promise<Task> => {
    let task: Task;
    if (isCloudSchema()) {
      const id = await db.tasks.add({ name, projectId: null, done: false, priority: 'medium', notes: '', effort: null, contextId: null, blocking: false, duration: null }) as string;
      task = { id, name, projectId: null, done: false, priority: 'medium', notes: '', effort: null, contextId: null, blocking: false, duration: null };
    } else {
      task = { id: newId(), name, projectId: null, done: false, priority: 'medium', notes: '', effort: null, contextId: null, blocking: false, duration: null };
      await db.tasks.put(task);
    }
    return task;
  };

  const deleteTask = async (taskId: string) => {
    await db.tasks.delete(taskId);
    setData(d => d ? ({ ...d, tasks: d.tasks.filter(t => t.id !== taskId) }) : d);
  };

  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    await db.tasks.update(taskId, updates);
    setData(d => d ? ({ ...d, tasks: d.tasks.map(t => t.id === taskId ? { ...t, ...updates } : t) }) : d);
  };

  const addNote = async (noteData: { title?: string; content: string }) => {
    if (!selectedProjectId) return;
    const now = new Date().toISOString();
    if (isCloudSchema()) {
      await db.projectNotes.add({ projectId: selectedProjectId, content: noteData.content, title: noteData.title ?? null, createdAt: now, updatedAt: now });
    } else {
      const note: ProjectNote = { id: newId(), projectId: selectedProjectId, content: noteData.content, title: noteData.title ?? null, createdAt: now, updatedAt: now };
      await db.projectNotes.put(note);
    }
  };

  const updateNote = async (noteId: string, updates: Partial<ProjectNote>) => {
    await db.projectNotes.update(noteId, updates);
    setData(d => d ? ({ ...d, projectNotes: d.projectNotes.map(n => n.id === noteId ? { ...n, ...updates } : n) }) : d);
  };

  const deleteNote = async (noteId: string) => {
    await db.projectNotes.delete(noteId);
    setData(d => d ? ({ ...d, projectNotes: d.projectNotes.filter(n => n.id !== noteId) }) : d);
  };

  const handleCompleteWithNextAction = async (task: Task, nextActionName: string) => {
    await updateTask(task.id, { done: true });
    let newTask: Task;
    if (isCloudSchema()) {
      const id = await db.tasks.add({ name: nextActionName, projectId: task.projectId, done: false, priority: 'medium', notes: '', effort: null, contextId: task.contextId, blocking: false, duration: null }) as string;
      newTask = { id, name: nextActionName, projectId: task.projectId, done: false, priority: 'medium', notes: '', effort: null, contextId: task.contextId, blocking: false, duration: null };
    } else {
      newTask = { id: newId(), name: nextActionName, projectId: task.projectId, done: false, priority: 'medium', notes: '', effort: null, contextId: task.contextId, blocking: false, duration: null };
      await db.tasks.put(newTask);
    }
    setSelectedProjectId(task.projectId);
    setSelectedTaskId(newTask.id);
  };

  // Helpers
  function collectProjectIds(rootId: string, allProjects: Project[]): string[] {
    const children = allProjects.filter(p => p.parentProjectId === rootId);
    return [rootId, ...children.flatMap(c => collectProjectIds(c.id, allProjects))];
  }

  const archiveProject = async (id: string) => {
    const ids = collectProjectIds(id, data.projects);
    const archivedAt = new Date().toISOString();
    await db.transaction('rw', [db.projects], async () => {
      for (const pid of ids) await db.projects.update(pid, { archived: true, archivedAt });
    });
    setData(d => {
      if (!d) return d;
      return { ...d, projects: d.projects.map(p => ids.includes(p.id) ? { ...p, archived: true, archivedAt } : p) };
    });
    if (selectedProjectId && ids.includes(selectedProjectId)) {
      setSelectedProjectId(null);
      setSelectedTaskId(null);
    }
    if (editingProjectId && ids.includes(editingProjectId)) setEditingProjectId(null);
  };

  const restoreProject = async (id: string) => {
    await db.projects.update(id, { archived: false, archivedAt: null });
    setData(d => {
      if (!d) return d;
      return { ...d, projects: d.projects.map(p => p.id === id ? { ...p, archived: false, archivedAt: null } : p) };
    });
  };

  const deleteProject = async (id: string) => {
    const ids = collectProjectIds(id, data.projects);
    const idsSet = new Set(ids);
    const taskIds = data.tasks.filter(t => t.projectId !== null && idsSet.has(t.projectId)).map(t => t.id);
    await db.transaction('rw', [db.projects, db.tasks], async () => {
      await db.projects.bulkDelete(ids);
      await db.tasks.bulkDelete(taskIds);
    });
    setData(d => {
      if (!d) return d;
      return {
        ...d,
        projects: d.projects.filter(p => !idsSet.has(p.id)),
        tasks: d.tasks.filter(t => t.projectId === null || !idsSet.has(t.projectId)),
      };
    });
    if (selectedProjectId && ids.includes(selectedProjectId)) {
      setSelectedProjectId(null);
      setSelectedTaskId(null);
    }
    if (editingProjectId && ids.includes(editingProjectId)) setEditingProjectId(null);
  };

  const deleteLifter = async (id: string) => {
    const rootIds = data.projects.filter(p => p.lifterId === id).map(p => p.id);
    const allIds = new Set(rootIds.flatMap(rid => collectProjectIds(rid, data.projects)));
    const projectIds = [...allIds];
    const taskIds = data.tasks.filter(t => t.projectId !== null && allIds.has(t.projectId)).map(t => t.id);
    await db.transaction('rw', [db.lifters, db.projects, db.tasks], async () => {
      await db.lifters.delete(id);
      await db.projects.bulkDelete(projectIds);
      await db.tasks.bulkDelete(taskIds);
    });
    setData(d => {
      if (!d) return d;
      return {
        ...d,
        lifters: d.lifters.filter(l => l.id !== id),
        projects: d.projects.filter(p => !allIds.has(p.id)),
        tasks: d.tasks.filter(t => t.projectId === null || !allIds.has(t.projectId)),
      };
    });
    if (selectedLifterId === id) {
      setSelectedLifterId(null);
      setSelectedProjectId(null);
      setSelectedTaskId(null);
    }
    if (editingLifterId === id) setEditingLifterId(null);
  };

  const renameLifter = async (id: string, name: string) => {
    await db.lifters.update(id, { name });
    setData(d => d ? ({ ...d, lifters: d.lifters.map(l => l.id === id ? { ...l, name } : l) }) : d);
  };

  const updateProject = async (id: string, updates: Partial<Project>) => {
    if (updates.endDate !== undefined && updates.endDate !== null) {
      const affectedTasks = data.tasks.filter(
        t => t.projectId === id && t.endDate && t.endDate > updates.endDate!
      );
      if (affectedTasks.length > 0) {
        await db.transaction('rw', [db.projects, db.tasks], async () => {
          await db.projects.update(id, updates);
          for (const t of affectedTasks) {
            await db.tasks.update(t.id, { endDate: updates.endDate });
          }
        });
        setData(d => d ? ({
          ...d,
          projects: d.projects.map(p => p.id === id ? { ...p, ...updates } : p),
          tasks: d.tasks.map(t =>
            affectedTasks.some(at => at.id === t.id)
              ? { ...t, endDate: updates.endDate }
              : t
          ),
        }) : d);
        return;
      }
    }
    await db.projects.update(id, updates);
    setData(d => d ? ({ ...d, projects: d.projects.map(p => p.id === id ? { ...p, ...updates } : p) }) : d);
  };


  const moveTaskToProject = async (taskId: string, targetProjectId: string, clampEndDate?: boolean) => {
    const task = data.tasks.find(t => t.id === taskId);
    const project = data.projects.find(p => p.id === targetProjectId);
    if (!task || task.projectId === targetProjectId) return;
    const taskUpdates: Partial<Task> = { projectId: targetProjectId };
    if (clampEndDate && project?.endDate && task.endDate && task.endDate > project.endDate) {
      taskUpdates.endDate = project.endDate;
    }
    await db.tasks.update(taskId, taskUpdates);
    setData(d => d ? ({ ...d, tasks: d.tasks.map(t => t.id === taskId ? { ...t, ...taskUpdates } : t) }) : d);
    if (selectedTaskId === taskId) setSelectedTaskId(null);
  };

  const moveProjectToLifter = async (projectId: string, targetLifterId: string) => {
    const project = data.projects.find(p => p.id === projectId);
    if (!project || (project.lifterId === targetLifterId && project.parentProjectId === null)) return;
    await db.projects.update(projectId, { lifterId: targetLifterId, parentProjectId: null });
    setData(d => d ? ({ ...d, projects: d.projects.map(p => p.id === projectId ? { ...p, lifterId: targetLifterId, parentProjectId: null } : p) }) : d);
  };

  const reparentProject = async (projectId: string, newParentId: string | null) => {
    const project = data.projects.find(p => p.id === projectId);
    if (!project || project.parentProjectId === newParentId) return;
    if (newParentId !== null) {
      const descendants = collectProjectIds(projectId, data.projects);
      if (descendants.includes(newParentId)) return;
    }
    const newSiblings = data.projects.filter(p => p.parentProjectId === newParentId && p.id !== projectId);
    const order = newSiblings.length > 0 ? Math.max(...newSiblings.map(p => p.order ?? 0)) + 1 : 0;
    const updates: Partial<Project> = { parentProjectId: newParentId, order };
    if (newParentId !== null) {
      const parent = data.projects.find(p => p.id === newParentId);
      if (parent) updates.lifterId = parent.lifterId;
    }
    await db.projects.update(projectId, updates);
    setData(d => d ? ({ ...d, projects: d.projects.map(p => p.id === projectId ? { ...p, ...updates } : p) }) : d);
  };

  const handleProjectDragEnd = () => {
    setDragPayload(null);
    setDropTargetProjectId(null);
    setDropTargetLifterId(null);
    setDropTargetRootZone(false);
    setDropGapTarget(null);
  };

  const reorderProject = async (projectId: string, newParentId: string | null, insertAfterProjectId: string | null) => {
    const project = data.projects.find(p => p.id === projectId);
    if (!project) return;
    if (newParentId !== null) {
      const descendants = collectProjectIds(projectId, data.projects);
      if (descendants.includes(newParentId)) return;
    }
    const siblings = data.projects
      .filter(p => p.parentProjectId === newParentId && p.areaId === project.areaId && p.id !== projectId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const insertIdx = insertAfterProjectId === null
      ? 0
      : siblings.findIndex(p => p.id === insertAfterProjectId) + 1;
    siblings.splice(insertIdx, 0, { ...project, parentProjectId: newParentId });
    const updates: { id: string; order: number; parentProjectId?: string | null; lifterId?: string | null }[] = siblings.map((p, i) => ({
      id: p.id,
      order: i,
      ...(p.id === projectId && p.parentProjectId !== project.parentProjectId ? { parentProjectId: newParentId } : {}),
      ...(p.id === projectId && newParentId !== null && newParentId !== project.parentProjectId ? (() => {
        const parent = data.projects.find(pr => pr.id === newParentId);
        return parent ? { lifterId: parent.lifterId } : {};
      })() : {}),
    }));
    await db.transaction('rw', db.projects, async () => {
      for (const u of updates) await db.projects.update(u.id, u);
    });
    setData(d => {
      if (!d) return d;
      const updateMap = new Map(updates.map(u => [u.id, u]));
      return { ...d, projects: d.projects.map(p => updateMap.has(p.id) ? { ...p, ...updateMap.get(p.id) } : p) };
    });
  };

  const reorderTask = async (taskId: string, insertAfterTaskId: string | null) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const siblings = tasks
      .filter(t => !t.done && t.id !== taskId)
      .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
    const insertIdx = insertAfterTaskId === null
      ? 0
      : siblings.findIndex(t => t.id === insertAfterTaskId) + 1;
    siblings.splice(insertIdx, 0, task);
    const updates = siblings.map((t, i) => ({ id: t.id, order: i }));
    await db.transaction('rw', db.tasks, async () => {
      for (const u of updates) await db.tasks.update(u.id, { order: u.order });
    });
    setData(d => {
      if (!d) return d;
      const map = new Map(updates.map(u => [u.id, u.order]));
      return { ...d, tasks: d.tasks.map(t => map.has(t.id) ? { ...t, order: map.get(t.id)! } : t) };
    });
  };

  const handleGapDragOver = (e: React.DragEvent, parentProjectId: string | null, insertAfterProjectId: string | null) => {
    if (!dragPayload || dragPayload.kind !== 'project') return;
    e.preventDefault();
    setDropTargetProjectId(null);
    setDropGapTarget({ parentProjectId, insertAfterProjectId });
  };

  const handleGapDrop = (parentProjectId: string | null, insertAfterProjectId: string | null) => {
    if (!dragPayload || dragPayload.kind !== 'project') return;
    setDropGapTarget(null);
    reorderProject(dragPayload.projectId, parentProjectId, insertAfterProjectId);
    setDragPayload(null);
  };

  const handleGapDragLeave = () => setDropGapTarget(null);

  const handleProjectDragOver = (e: React.DragEvent, projectId: string) => {
    if (!dragPayload) return;
    e.preventDefault();
    setDropTargetProjectId(projectId);
    setDropGapTarget(null);
  };

  const handleProjectDrop = (targetProjectId: string) => {
    if (!dragPayload) return;
    setDropTargetProjectId(null);
    if (dragPayload.kind === 'task') {
      moveTaskToProject(dragPayload.taskId, targetProjectId);
    } else if (dragPayload.kind === 'project') {
      if (dragPayload.projectId !== targetProjectId) reparentProject(dragPayload.projectId, targetProjectId);
    }
    setDragPayload(null);
  };

  const handleProjectDragLeave = (e: React.DragEvent, projectId: string) => {
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setDropTargetProjectId(prev => prev === projectId ? null : prev);
    }
  };

  const openLifterEdit = (id: string) => {
    setEditingLifterId(id);
    setEditingProjectId(null);
    setSelectedTaskId(null);
  };

  const openProjectEdit = (id: string) => {
    setEditingProjectId(id);
    setEditingLifterId(null);
    setSelectedTaskId(null);
  };

  const deleteArea = async (id: string) => {
    const lifterIds = data.lifters.filter(l => l.areaId === id).map(l => l.id);
    const rootIds = data.projects.filter(p => p.areaId === id).map(p => p.id);
    const allProjectIds = new Set(rootIds.flatMap(rid => collectProjectIds(rid, data.projects)));
    const projectIds = [...allProjectIds];
    const taskIds = data.tasks.filter(t => t.projectId !== null && allProjectIds.has(t.projectId)).map(t => t.id);
    await db.transaction('rw', [db.areas, db.lifters, db.projects, db.tasks], async () => {
      await db.areas.delete(id);
      await db.lifters.bulkDelete(lifterIds);
      await db.projects.bulkDelete(projectIds);
      await db.tasks.bulkDelete(taskIds);
    });
    setData(d => {
      if (!d) return d;
      return {
        ...d,
        areas: d.areas.filter(a => a.id !== id),
        lifters: d.lifters.filter(l => !lifterIds.includes(l.id)),
        projects: d.projects.filter(p => !allProjectIds.has(p.id)),
        tasks: d.tasks.filter(t => t.projectId === null || !allProjectIds.has(t.projectId)),
      };
    });
    if (selectedAreaId === id) {
      const remaining = data.areas.filter(a => a.id !== id);
      selectArea(remaining[0]?.id ?? '');
    } else {
      const lifterSet = new Set(lifterIds);
      if (editingLifterId && lifterSet.has(editingLifterId)) setEditingLifterId(null);
      if (editingProjectId && allProjectIds.has(editingProjectId)) setEditingProjectId(null);
    }
  };

  const reorderAreas = async (fromIndex: number, toIndex: number) => {
    const areas = [...data.areas];
    const [moved] = areas.splice(fromIndex, 1);
    areas.splice(toIndex, 0, moved);
    const withOrder = areas.map((a, i) => ({ ...a, order: i }));
    await db.areas.bulkPut(withOrder);
    // liveQuery will emit the update — no setData needed
  };

  // Contexts
  const addContext = async (name: string, icon: string) => {
    let ctx: Context;
    if (isCloudSchema()) {
      const id = await db.contexts.add({ name, icon }) as string;
      ctx = { id, name, icon };
    } else {
      ctx = { id: newId(), name, icon };
      await db.contexts.put(ctx);
    }
  };

  // Work Blocks
  const addWorkBlock = async (block: Omit<WorkBlock, 'id'>) => {
    let wb: WorkBlock;
    if (isCloudSchema()) {
      const id = await db.workBlocks.add(block as WorkBlock) as string;
      wb = { ...block, id };
    } else {
      wb = { ...block, id: newId() };
      await db.workBlocks.put(wb);
    }
    setData(d => d ? ({ ...d, workBlocks: [...d.workBlocks, wb] }) : d);
  };

  const updateWorkBlock = async (id: string, updates: Partial<WorkBlock>) => {
    await db.workBlocks.update(id, updates);
    setData(d => d ? ({ ...d, workBlocks: d.workBlocks.map(wb => wb.id === id ? { ...wb, ...updates } : wb) }) : d);
  };

  const deleteWorkBlock = async (id: string) => {
    await db.workBlocks.delete(id);
    setData(d => d ? ({ ...d, workBlocks: d.workBlocks.filter(wb => wb.id !== id) }) : d);
  };

  const duplicateWorkBlock = async (id: string) => {
    const original = data?.workBlocks.find(wb => wb.id === id);
    if (!original) return;
    const { id: _id, ...rest } = original;
    await addWorkBlock({ ...rest });
  };

  // Block Templates
  const addBlockTemplate = (t: Omit<BlockTemplate, 'id'>) => {
    const newTemplate: BlockTemplate = { ...t, id: crypto.randomUUID() };
    setBlockTemplates(prev => {
      const updated = [...prev, newTemplate];
      localStorage.setItem('dopadone-block-templates', JSON.stringify(updated));
      return updated;
    });
  };

  const deleteBlockTemplate = (id: string) => {
    setBlockTemplates(prev => {
      const updated = prev.filter(t => t.id !== id);
      localStorage.setItem('dopadone-block-templates', JSON.stringify(updated));
      return updated;
    });
  };

  // Events
  const addEvent = async (eventData: Omit<CalendarEvent, 'id'>): Promise<CalendarEvent> => {
    let event: CalendarEvent;
    if (isCloudSchema()) {
      const id = await db.events.add(eventData as CalendarEvent) as string;
      event = { ...eventData, id };
    } else {
      event = { ...eventData, id: newId() };
      await db.events.put(event);
    }
    setData(d => d ? ({ ...d, events: [...d.events, event] }) : d);
    return event;
  };

  const updateEvent = async (id: string, updates: Partial<CalendarEvent>) => {
    await db.events.update(id, updates);
    setData(d => d ? ({ ...d, events: d.events.map(e => e.id === id ? { ...e, ...updates } : e) }) : d);
  };

  const deleteEvent = async (id: string) => {
    await db.events.delete(id);
    setData(d => d ? ({ ...d, events: d.events.filter(e => e.id !== id) }) : d);
  };

  const addEventTask = async (eventId: string, name: string) => {
    const event = data.events.find(e => e.id === eventId);
    if (!event) return;
    let task: Task;
    const projectId = event.projectId;
    if (isCloudSchema()) {
      const id = await db.tasks.add({ name, projectId, done: false, priority: 'medium', notes: '', effort: null, contextId: null, blocking: false, duration: null }) as string;
      task = { id, name, projectId, done: false, priority: 'medium', notes: '', effort: null, contextId: null, blocking: false, duration: null };
    } else {
      task = { id: newId(), name, projectId, done: false, priority: 'medium', notes: '', effort: null, contextId: null, blocking: false, duration: null };
      await db.tasks.put(task);
    }
    const updatedTaskIds = [...event.taskIds, task.id];
    await db.events.update(eventId, { taskIds: updatedTaskIds });
    setData(d => {
      if (!d) return d;
      return {
        ...d,
        tasks: [...d.tasks, task],
        events: d.events.map(e => e.id === eventId ? { ...e, taskIds: updatedTaskIds } : e),
      };
    });
  };

  const deleteContext = async (id: string) => {
    await db.transaction('rw', [db.contexts, db.tasks], async () => {
      await db.contexts.delete(id);
      // Clear contextId from tasks that used this context
      const affected = await db.tasks.where('contextId').equals(id).toArray();
      await db.tasks.bulkPut(affected.map(t => ({ ...t, contextId: null })));
    });
    setData(d => d ? ({
      ...d,
      contexts: d.contexts.filter(c => c.id !== id),
      tasks: d.tasks.map(t => t.contextId === id ? { ...t, contextId: null } : t),
    }) : d);
  };

  return (
    <div className="app">
      <header className="app-header">
        <button className="hamburger-btn" onClick={() => setMobileNavOpen(true)} aria-label="Menu">
          <span /><span /><span />
        </button>
        <div className="logo">Dopadone</div>
        <div className="view-tabs">
          <button
            className={`view-tab inbox-tab ${currentView === 'inbox' ? 'active' : ''}`}
            onClick={() => setCurrentView('inbox')}
            data-tour="inbox"
          >
            Inbox
            {inboxTaskCount > 0 && (
              <span className="inbox-badge">{inboxTaskCount}</span>
            )}
          </button>
          <button
            className={`view-tab ${currentView === 'today' ? 'active' : ''}`}
            onClick={() => setCurrentView('today')}
            data-tour="today"
          >Dziś</button>
          <button
            className={`view-tab ${currentView === 'agenda' ? 'active' : ''}`}
            onClick={() => setCurrentView('agenda')}
            data-tour="agenda"
          >Agenda</button>
          <button
            className={`view-tab ${currentView === 'plan' ? 'active' : ''}`}
            onClick={() => setCurrentView('plan')}
            data-tour="plan"
          >Planowanie</button>
          <button
            className={`view-tab ${currentView === 'do' ? 'active' : ''}`}
            onClick={() => setCurrentView('do')}
          >Robienie</button>
          <button
            className={`view-tab processing-tab ${currentView === 'processing' ? 'active' : ''}`}
            onClick={() => setCurrentView('processing')}
          >
            Procesowanie
            {processingBadgeCount > 0 && (
              <span className="inbox-badge">{processingBadgeCount}</span>
            )}
          </button>
        </div>
        <button className="quick-add-btn" onClick={() => setModal('inbox-add')} title="Dodaj zadanie do Inboxu (Cmd+Shift+Spacja)">+ Zadanie</button>
        <button className="settings-btn" onClick={() => setModal('settings')} title="Ustawienia" data-tour="settings">
          ⚙ Ustawienia
        </button>
      </header>

      {mobileNavOpen && (
        <div className="mobile-nav-overlay" onClick={() => setMobileNavOpen(false)}>
          <div className="mobile-nav-panel" onClick={e => e.stopPropagation()}>
            <button className="mobile-nav-close" onClick={() => setMobileNavOpen(false)}>✕</button>
            <nav className="mobile-nav-items">
              <button
                className={`mobile-nav-item ${currentView === 'inbox' ? 'active' : ''}`}
                onClick={() => { setCurrentView('inbox'); setMobileNavOpen(false); }}
              >
                Inbox
                {inboxTaskCount > 0 && (
                  <span className="mobile-nav-badge">{inboxTaskCount}</span>
                )}
              </button>
              <button
                className={`mobile-nav-item ${currentView === 'today' ? 'active' : ''}`}
                onClick={() => { setCurrentView('today'); setMobileNavOpen(false); }}
              >Dziś</button>
              <button
                className={`mobile-nav-item ${currentView === 'agenda' ? 'active' : ''}`}
                onClick={() => { setCurrentView('agenda'); setMobileNavOpen(false); }}
              >Agenda</button>
              <button
                className={`mobile-nav-item ${currentView === 'plan' ? 'active' : ''}`}
                onClick={() => { setCurrentView('plan'); setMobileNavOpen(false); }}
              >Planowanie</button>
              <button
                className={`mobile-nav-item ${currentView === 'do' ? 'active' : ''}`}
                onClick={() => { setCurrentView('do'); setMobileNavOpen(false); }}
              >Robienie</button>
              <button
                className={`mobile-nav-item ${currentView === 'processing' ? 'active' : ''}`}
                onClick={() => { setCurrentView('processing'); setMobileNavOpen(false); }}
              >
                Procesowanie
                {processingBadgeCount > 0 && (
                  <span className="mobile-nav-badge">{processingBadgeCount}</span>
                )}
              </button>
            </nav>
          </div>
        </div>
      )}

      {currentView === 'plan' && (
        <nav className="local-nav">
          {data.areas.map(area => (
            <button
              key={area.id}
              className={`area-tab ${area.id === selectedAreaId ? 'active' : ''}`}
              style={area.id === selectedAreaId ? { borderBottomColor: area.color, color: area.color } : {}}
              onClick={() => selectArea(area.id)}
            >
              {area.name}
            </button>
          ))}
          <button className="area-tab add-tab" onClick={() => setModal('area')}>+ Obszar</button>
        </nav>
      )}

      {currentView === 'inbox' && (
        <InboxView
          tasks={data.tasks.filter(t => t.projectId === null)}
          projects={data.projects.filter(p => !p.archived)}
          areas={data.areas}
          lifters={data.lifters}
          contexts={data.contexts}
          onAddTask={name => addInboxTask(name).then(() => {})}
          onUpdateTask={updateTask}
          onDeleteTask={deleteTask}
          onAssignToProject={(taskId, projectId, clampEndDate) => moveTaskToProject(taskId, projectId, clampEndDate)}
        />
      )}

      {currentView === 'today' && (
        <TodayView
          areas={data.areas}
          lifters={data.lifters}
          projects={data.projects}
          tasks={data.tasks}
          contexts={data.contexts}
          workBlocks={data.workBlocks}
          events={data.events}
          blockTemplates={blockTemplates}
          onUpdateTask={updateTask}
          onAddEvent={addEvent}
          onUpdateEvent={updateEvent}
          onDeleteEvent={deleteEvent}
          onAddEventTask={addEventTask}
          onAddWorkBlock={addWorkBlock}
          onUpdateWorkBlock={updateWorkBlock}
          onDuplicateWorkBlock={duplicateWorkBlock}
        />
      )}

      {currentView === 'agenda' && (
        <AgendaView
          areas={data.areas}
          lifters={data.lifters}
          projects={data.projects}
          contexts={data.contexts}
          tasks={data.tasks}
          workBlocks={data.workBlocks}
          events={data.events}
          blockTemplates={blockTemplates}
          onAdd={addWorkBlock}
          onUpdate={updateWorkBlock}
          onDelete={deleteWorkBlock}
          onDuplicate={duplicateWorkBlock}
          onUpdateTask={updateTask}
          onDeleteTask={deleteTask}
          onCompleteWithNextAction={handleCompleteWithNextAction}
          onAddInboxTask={async name => { const t = await addInboxTask(name); return t.id; }}
          onAddEvent={addEvent}
          onUpdateEvent={updateEvent}
          onDeleteEvent={deleteEvent}
          onAddEventTask={addEventTask}
        />
      )}

      {currentView === 'do' && (
        <DoingView
          tasks={data.tasks}
          contexts={data.contexts}
          onUpdateTask={updateTask}
          onDeleteTask={deleteTask}
          onCompleteWithNextAction={handleCompleteWithNextAction}
        />
      )}

      {currentView === 'processing' && (
        <ProcessingView
          tasks={data.tasks.filter(t => !t.done)}
          projects={data.projects.filter(p => !p.archived)}
          areas={data.areas}
          lifters={data.lifters}
          contexts={data.contexts}
          onUpdateTask={updateTask}
          onDeleteTask={deleteTask}
          onCreateProject={addProjectForProcessing}
          onConvertToProject={convertTaskToProject}
        />
      )}

      <main
        className={`columns${(selectedTask || editingLifterId !== null || editingProjectId !== null) ? ' panel-open' : ''}`}
        style={currentView !== 'plan' ? { display: 'none' } : undefined}
      >
        {/* Column 1: Lifters */}
        <section
          className={`column ${expandedColumns.has('lifters') ? 'expanded' : ''}`}
          id="column-lifters"
        >
          <div
            className="column-header"
            style={{ borderTopColor: selectedArea?.color }}
            role="button"
            tabIndex={0}
            aria-expanded={expandedColumns.has('lifters')}
            aria-controls="column-body-lifters"
            onClick={() => toggleColumn('lifters')}
            onKeyDown={e => handleColumnKeydown(e, 'lifters')}
          >
            <h2 id="column-header-lifters">Podobszary</h2>
            <button onClick={e => { e.stopPropagation(); setModal('lifter'); }}>+</button>
          </div>
          <div
            className="column-body"
            id="column-body-lifters"
            role="region"
            aria-labelledby="column-header-lifters"
          >
            {lifters.length === 0 && <p className="empty-hint">Brak podobszarów w tym obszarze</p>}
            {lifters.map(l => (
              <div
                key={l.id}
                className={`list-item-row${dropTargetLifterId === l.id ? ' drop-target-active' : ''}`}
                onDragOver={e => {
                  if (dragPayload?.kind === 'project') { e.preventDefault(); setDropTargetLifterId(l.id); }
                }}
                onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTargetLifterId(null); }}
                onDrop={e => {
                  e.preventDefault(); setDropTargetLifterId(null);
                  if (dragPayload?.kind === 'project') { moveProjectToLifter(dragPayload.projectId, l.id); setDragPayload(null); }
                }}
              >
                <div
                  className={`list-item ${selectedLifterId === l.id ? 'selected' : ''}`}
                  onClick={() => selectLifter(l.id)}
                  style={selectedLifterId === l.id ? { borderLeftColor: selectedArea?.color } : {}}
                >
                  {l.name}
                </div>
                <RowMenuButton
                  onEdit={() => openLifterEdit(l.id)}
                  onDelete={() => deleteLifter(l.id)}
                />
              </div>
            ))}
          </div>
        </section>

        {/* Column 2: Projects */}
        <section
          className={`column ${expandedColumns.has('projects') ? 'expanded' : ''}`}
          id="column-projects"
        >
          <div
            className="column-header"
            style={{ borderTopColor: selectedArea?.color }}
            role="button"
            tabIndex={0}
            aria-expanded={expandedColumns.has('projects')}
            aria-controls="column-body-projects"
            onClick={() => toggleColumn('projects')}
            onKeyDown={e => handleColumnKeydown(e, 'projects')}
          >
            <h2 id="column-header-projects">Projekty</h2>
            <div className="header-actions">
              {selectedProjectId && (
                <button onClick={e => { e.stopPropagation(); setModal('subproject'); }} title="Dodaj podprojekt">⤷</button>
              )}
              <button onClick={e => { e.stopPropagation(); setModal('project'); }}>+</button>
            </div>
          </div>
          <div
            className="column-body"
            id="column-body-projects"
            role="region"
            aria-labelledby="column-header-projects"
          >
            {dragPayload?.kind === 'project' && (() => {
              const dragged = data.projects.find(p => p.id === (dragPayload as { kind: 'project'; projectId: string }).projectId);
              return dragged?.parentProjectId !== null ? (
                <div
                  className={`root-drop-zone${dropTargetRootZone ? ' active' : ''}`}
                  onDragOver={e => { e.preventDefault(); setDropTargetRootZone(true); }}
                  onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget as Node)) setDropTargetRootZone(false); }}
                  onDrop={e => {
                    e.preventDefault(); setDropTargetRootZone(false);
                    reparentProject((dragPayload as { kind: 'project'; projectId: string }).projectId, null);
                    setDragPayload(null);
                  }}
                >
                  Upuść tutaj, aby przenieść do głównych projektów
                </div>
              ) : null;
            })()}
            {rootProjects.length === 0 && (
              <p className="empty-hint">Brak projektów{selectedLifterId ? ' dla tego podobszaru' : ''}</p>
            )}
            <ProjectTree
              projects={rootProjects}
              allProjects={visibleProjects}
              selectedProjectId={selectedProjectId}
              onSelect={id => { setSelectedProjectId(id); setSelectedTaskId(null); setProjectTab('tasks'); }}
              onDelete={deleteProject}
              onArchive={archiveProject}
              onEdit={openProjectEdit}
              dragPayload={dragPayload}
              dropTargetProjectId={dropTargetProjectId}
              dropGapTarget={dropGapTarget}
              onProjectDragStart={id => setDragPayload({ kind: 'project', projectId: id })}
              onProjectDragEnd={handleProjectDragEnd}
              onProjectDragOver={handleProjectDragOver}
              onProjectDrop={handleProjectDrop}
              onProjectDragLeave={handleProjectDragLeave}
              onGapDragOver={handleGapDragOver}
              onGapDrop={handleGapDrop}
              onGapDragLeave={handleGapDragLeave}
            />
          </div>
        </section>

        {/* Column 3: Tasks / Notes (tabbed) */}
        <section
          className={`column ${expandedColumns.has('tasks') ? 'expanded' : ''}`}
          id="column-tasks"
        >
          <div
            className="column-header"
            style={{ borderTopColor: selectedArea?.color }}
            role="button"
            tabIndex={0}
            aria-expanded={expandedColumns.has('tasks')}
            aria-controls="column-body-tasks"
            onClick={() => toggleColumn('tasks')}
            onKeyDown={e => handleColumnKeydown(e, 'tasks')}
          >
            {selectedProjectId ? (
              <div className="column-tabs" onClick={e => e.stopPropagation()}>
                <button
                  className={`column-tab ${projectTab === 'tasks' ? 'active' : ''}`}
                  onClick={() => setProjectTab('tasks')}
                >Zadania</button>
                <button
                  className={`column-tab ${projectTab === 'notes' ? 'active' : ''}`}
                  onClick={() => setProjectTab('notes')}
                >Notatki</button>
              </div>
            ) : (
              <h2 id="column-header-tasks">Zadania</h2>
            )}
          </div>
          {projectTab === 'tasks' && (
            <div
              className="column-body"
              id="column-body-tasks"
              role="region"
              aria-labelledby="column-header-tasks"
            >
              {!selectedProjectId && <p className="empty-hint">Wybierz projekt, aby zobaczyć zadania</p>}
              {selectedProjectId && (
                <div className="task-quick-add">
                  <input
                    className="task-quick-add-input"
                    type="text"
                    placeholder="Dodaj zadanie..."
                    value={quickAddTaskName}
                    onChange={e => setQuickAddTaskName(e.target.value)}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && quickAddTaskName.trim()) {
                        addTask(quickAddTaskName.trim());
                        setQuickAddTaskName('');
                      }
                    }}
                  />
                </div>
              )}
              {selectedProjectId && dragPayload?.kind === 'task' && (
                <div
                  className={`task-gap-zone${dropTaskGapTarget === null ? ' active' : ''}`}
                  onDragOver={e => { e.preventDefault(); setDropTaskGapTarget(null); }}
                  onDrop={() => { if (dragPayload.kind === 'task') { reorderTask(dragPayload.taskId, null); } setDropTaskGapTarget(undefined); }}
                  onDragLeave={() => setDropTaskGapTarget(undefined)}
                />
              )}
              {undoneTasks.map(task => {
                const ctx = task.contextId ? contextsMap.get(task.contextId) : undefined;
                return (
                  <React.Fragment key={task.id}>
                    <div
                      className={`task-item ${task.id === selectedTaskId ? 'selected' : ''}`}
                      draggable
                      onDragStart={() => setDragPayload({ kind: 'task', taskId: task.id })}
                      onDragEnd={() => { setDragPayload(null); setDropTaskGapTarget(undefined); }}
                      onClick={() => selectTask(task.id)}
                    >
                      <div className="task-main">
                        <input
                          type="checkbox"
                          checked={false}
                          onChange={() => updateTask(task.id, { done: true })}
                          onClick={e => e.stopPropagation()}
                        />
                        <span className="task-name">{task.name}</span>
                        <span className="priority-dot" style={{ background: priorityColors[task.priority] }} title={task.priority} />
                        {task.effort && <span className="tag effort-tag">{task.effort.toUpperCase()}</span>}
                        {ctx && <span className="tag context-tag">{ctx.icon}</span>}
                      </div>
                    </div>
                    {dragPayload?.kind === 'task' && task.id !== dragPayload.taskId && (
                      <div
                        className={`task-gap-zone${dropTaskGapTarget === task.id ? ' active' : ''}`}
                        onDragOver={e => { e.preventDefault(); setDropTaskGapTarget(task.id); }}
                        onDrop={() => { if (dragPayload.kind === 'task') { reorderTask(dragPayload.taskId, task.id); } setDropTaskGapTarget(undefined); }}
                        onDragLeave={() => setDropTaskGapTarget(undefined)}
                      />
                    )}
                  </React.Fragment>
                );
              })}
              {doneTasks.length > 0 && (
                <div className="block-done-section">
                  <button
                    className="block-done-toggle"
                    onClick={() => setShowPlanDone(v => !v)}
                  >
                    {showPlanDone ? '▾' : '▸'} Ukończone ({doneTasks.length})
                  </button>
                  {showPlanDone && doneTasks.map(task => {
                    const ctx = task.contextId ? contextsMap.get(task.contextId) : undefined;
                    return (
                      <div
                        key={task.id}
                        className={`task-item done ${task.id === selectedTaskId ? 'selected' : ''}`}
                        draggable
                        onDragStart={() => setDragPayload({ kind: 'task', taskId: task.id })}
                        onDragEnd={() => setDragPayload(null)}
                        onClick={() => selectTask(task.id)}
                      >
                        <div className="task-main">
                          <input
                            type="checkbox"
                            checked={true}
                            onChange={() => updateTask(task.id, { done: false })}
                            onClick={e => e.stopPropagation()}
                          />
                          <span className="task-name">{task.name}</span>
                          <span className="priority-dot" style={{ background: priorityColors[task.priority] }} title={task.priority} />
                          {task.effort && <span className="tag effort-tag">{task.effort.toUpperCase()}</span>}
                          {ctx && <span className="tag context-tag">{ctx.icon}</span>}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}
          {projectTab === 'notes' && selectedProjectId && (
            <div className="column-body column-body-notes" role="region">
              <ProjectNotesPanel
                projectId={selectedProjectId}
                notes={projectNotes}
                onCreate={addNote}
                onUpdate={updateNote}
                onDelete={deleteNote}
              />
            </div>
          )}
        </section>

        {/* Column 4: Task Detail Panel / Item Edit Panel */}
        {selectedTask && (
          <TaskDetailPanel
            task={selectedTask}
            contexts={data.contexts}
            project={data.projects.find(p => p.id === selectedTask.projectId) ?? null}
            onUpdate={(key, value) => updateTask(selectedTask.id, { [key]: value })}
            onDelete={() => { deleteTask(selectedTask.id); setSelectedTaskId(null); }}
            onClose={() => setSelectedTaskId(null)}
            onCompleteWithNextAction={(name) => handleCompleteWithNextAction(selectedTask, name)}
          />
        )}
        {!selectedTask && editingLifterId && (() => {
          const lifter = data.lifters.find(l => l.id === editingLifterId);
          return lifter ? (
            <ItemDetailPanel
              title="Podobszar"
              name={lifter.name}
              onRename={n => renameLifter(editingLifterId, n)}
              onDelete={() => { deleteLifter(editingLifterId); setEditingLifterId(null); }}
              onClose={() => setEditingLifterId(null)}
            />
          ) : null;
        })()}
        {!selectedTask && !editingLifterId && editingProjectId && (() => {
          const project = data.projects.find(p => p.id === editingProjectId);
          if (!project) return null;
          const projectLifters = data.lifters.filter(l => l.areaId === project.areaId);
          const descendants = collectProjectIds(editingProjectId, data.projects);
          const parentCandidates = data.projects.filter(p =>
            p.areaId === project.areaId &&
            p.id !== editingProjectId &&
            !descendants.includes(p.id)
          ).sort((a, b) => a.name.localeCompare(b.name, 'pl'));
          return (
            <ProjectDetailPanel
              project={project}
              tasks={data.tasks.filter(t => t.projectId === editingProjectId)}
              lifters={projectLifters}
              parentCandidates={parentCandidates}
              onUpdate={updates => updateProject(editingProjectId, updates)}
              onMoveToParent={parentId => reparentProject(editingProjectId, parentId)}
              onMoveToLifter={lifterId => {
                if (lifterId) moveProjectToLifter(editingProjectId, lifterId);
                else updateProject(editingProjectId, { lifterId: null });
              }}
              onArchive={() => { archiveProject(editingProjectId); setEditingProjectId(null); }}
              onDelete={() => { deleteProject(editingProjectId); setEditingProjectId(null); }}
              onClose={() => setEditingProjectId(null)}
            />
          );
        })()}
      </main>

      {modal === 'area' && <AddItemModal title="Nowy obszar" placeholder="np. Finanse" onAdd={addArea} onClose={() => setModal(null)} />}
      {modal === 'lifter' && <AddItemModal title="Nowy podobszar" placeholder="np. Samochód" onAdd={addLifter} onClose={() => setModal(null)} />}
      {modal === 'project' && <AddItemModal title="Nowy projekt" placeholder="np. Remont łazienki" onAdd={n => addProject(n)} onClose={() => setModal(null)} />}
      {modal === 'subproject' && <AddItemModal title="Nowy podprojekt" placeholder="np. Kafelki" onAdd={n => addProject(n, selectedProjectId)} onClose={() => setModal(null)} />}
      {modal === 'inbox-add' && <AddItemModal title="Dodaj do Inboxu" placeholder="np. Zadzwoń do dentysty" onAdd={name => addInboxTask(name).then(() => {})} onClose={() => setModal(null)} />}
      {modal === 'settings' && (
        <SettingsModal
          areas={data.areas}
          lifters={data.lifters}
          contexts={data.contexts}
          projects={data.projects}
          blockTemplates={blockTemplates}
          onDeleteArea={deleteArea}
          onDeleteLifter={deleteLifter}
          onReorderAreas={reorderAreas}
          onAddContext={addContext}
          onDeleteContext={deleteContext}
          onRestoreProject={restoreProject}
          onAddBlockTemplate={addBlockTemplate}
          onDeleteBlockTemplate={deleteBlockTemplate}
          onClose={() => setModal(null)}
        />
      )}
      {showTour && (
        <SpotlightTour
          onDone={() => {
            localStorage.setItem('dopadone-tour-complete', 'true');
            setShowTour(false);
          }}
        />
      )}
    </div>
  );
}
