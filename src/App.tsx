import { useState, useEffect, useRef } from 'react';
import { liveQuery } from 'dexie';
import type { AppState, Area, Lifter, Project, Task, Context, WorkBlock } from './types';
import { loadData, queryAllData } from './data';
import { db } from './db';
import { AddItemModal } from './components/AddItemModal';
import { ProjectTree } from './components/ProjectTree';
import { SettingsModal } from './components/SettingsModal';
import { TaskDetailPanel } from './components/TaskDetailPanel';
import { RowMenuButton } from './components/RowMenuButton';
import { ItemDetailPanel } from './components/ItemDetailPanel';
import { DoingView } from './components/DoingView';
import { AgendaView } from './components/AgendaView';
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
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [editingLifterId, setEditingLifterId] = useState<string | null>(null);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [modal, setModal] = useState<null | 'area' | 'lifter' | 'project' | 'subproject' | 'task' | 'settings'>(null);
  const [expandedColumns, setExpandedColumns] = useState<Set<string>>(new Set(['lifters']));
  const [currentView, setCurrentView] = useState<'plan' | 'do' | 'agenda'>('plan');
  const prevAreasCount = useRef(0);

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
    const applyInitialData = (d: AppState) => {
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
    };

    let subscription: { unsubscribe: () => void } | null = null;

    completeMigrationIfPending()
      .then(() => loadData())
      .then(d => {
        prevAreasCount.current = d.areas.length;
        applyInitialData(d);

        // Subscribe to live updates (e.g. from Dexie Cloud sync)
        subscription = liveQuery(() => queryAllData()).subscribe({
          next: (updated) => {
            const wasEmpty = prevAreasCount.current === 0 && updated.areas.length > 0;
            prevAreasCount.current = updated.areas.length;
            if (wasEmpty) {
              // Cloud sync brought data into empty db — auto-select
              applyInitialData(updated);
            } else {
              setData(updated);
            }
          },
          error: (err) => console.error('liveQuery error:', err),
        });
      })
      .catch(err => {
        console.error('Failed to load data:', err);
        applyInitialData({ areas: [], lifters: [], projects: [], tasks: [], contexts: [], workBlocks: [] });
      });

    return () => subscription?.unsubscribe();
  }, []);

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

  const lifters = data.lifters.filter(l => l.areaId === selectedAreaId);

  const visibleProjects = data.projects.filter(p => {
    if (p.areaId !== selectedAreaId) return false;
    if (selectedLifterId) return p.lifterId === selectedLifterId;
    return true;
  });

  const visibleIds = new Set(visibleProjects.map(p => p.id));
  const rootProjects = visibleProjects.filter(p =>
    p.parentProjectId === null || !visibleIds.has(p.parentProjectId)
  );

  const tasks = selectedProjectId
    ? data.tasks.filter(t => t.projectId === selectedProjectId)
    : [];

  const selectedTask = tasks.find(t => t.id === selectedTaskId) ?? null;
  const selectedArea = data.areas.find(a => a.id === selectedAreaId);

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
    let proj: Project;
    if (isCloudSchema()) {
      const id = await db.projects.add({ name, areaId: selectedAreaId, lifterId: selectedLifterId, parentProjectId }) as string;
      proj = { id, name, areaId: selectedAreaId, lifterId: selectedLifterId, parentProjectId };
    } else {
      proj = { id: newId(), name, areaId: selectedAreaId, lifterId: selectedLifterId, parentProjectId };
      await db.projects.put(proj);
    }
  };

  // Tasks
  const addTask = async (name: string) => {
    if (!selectedProjectId) return;
    let task: Task;
    if (isCloudSchema()) {
      const id = await db.tasks.add({ name, projectId: selectedProjectId, done: false, priority: 'medium', notes: '', effort: null, contextId: null, blocking: false }) as string;
      task = { id, name, projectId: selectedProjectId, done: false, priority: 'medium', notes: '', effort: null, contextId: null, blocking: false };
    } else {
      task = { id: newId(), name, projectId: selectedProjectId, done: false, priority: 'medium', notes: '', effort: null, contextId: null, blocking: false };
      await db.tasks.put(task);
    }
  };

  const deleteTask = async (taskId: string) => {
    await db.tasks.delete(taskId);
    setData(d => d ? ({ ...d, tasks: d.tasks.filter(t => t.id !== taskId) }) : d);
  };

  const updateTask = async (taskId: string, updates: Partial<Task>) => {
    await db.tasks.update(taskId, updates);
    setData(d => d ? ({ ...d, tasks: d.tasks.map(t => t.id === taskId ? { ...t, ...updates } : t) }) : d);
  };

  const handleCompleteWithNextAction = async (task: Task, nextActionName: string) => {
    await updateTask(task.id, { done: true });
    let newTask: Task;
    if (isCloudSchema()) {
      const id = await db.tasks.add({ name: nextActionName, projectId: task.projectId, done: false, priority: 'medium', notes: '', effort: null, contextId: task.contextId, blocking: false }) as string;
      newTask = { id, name: nextActionName, projectId: task.projectId, done: false, priority: 'medium', notes: '', effort: null, contextId: task.contextId, blocking: false };
    } else {
      newTask = { id: newId(), name: nextActionName, projectId: task.projectId, done: false, priority: 'medium', notes: '', effort: null, contextId: task.contextId, blocking: false };
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

  const deleteProject = async (id: string) => {
    const ids = collectProjectIds(id, data.projects);
    const idsSet = new Set(ids);
    const taskIds = data.tasks.filter(t => idsSet.has(t.projectId)).map(t => t.id);
    await db.transaction('rw', [db.projects, db.tasks], async () => {
      await db.projects.bulkDelete(ids);
      await db.tasks.bulkDelete(taskIds);
    });
    setData(d => {
      if (!d) return d;
      return {
        ...d,
        projects: d.projects.filter(p => !idsSet.has(p.id)),
        tasks: d.tasks.filter(t => !idsSet.has(t.projectId)),
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
    const taskIds = data.tasks.filter(t => allIds.has(t.projectId)).map(t => t.id);
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
        tasks: d.tasks.filter(t => !allIds.has(t.projectId)),
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

  const renameProject = async (id: string, name: string) => {
    await db.projects.update(id, { name });
    setData(d => d ? ({ ...d, projects: d.projects.map(p => p.id === id ? { ...p, name } : p) }) : d);
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
    const taskIds = data.tasks.filter(t => allProjectIds.has(t.projectId)).map(t => t.id);
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
        tasks: d.tasks.filter(t => !allProjectIds.has(t.projectId)),
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
        <div className="logo">Dopadone</div>
        <div className="view-tabs">
          <button
            className={`view-tab ${currentView === 'plan' ? 'active' : ''}`}
            onClick={() => setCurrentView('plan')}
          >Planowanie</button>
          <button
            className={`view-tab ${currentView === 'do' ? 'active' : ''}`}
            onClick={() => setCurrentView('do')}
          >Robienie</button>
          <button
            className={`view-tab ${currentView === 'agenda' ? 'active' : ''}`}
            onClick={() => setCurrentView('agenda')}
          >Agenda</button>
        </div>
        <button className="settings-btn" onClick={() => setModal('settings')} title="Ustawienia">
          ⚙ Ustawienia
        </button>
      </header>

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

      {currentView === 'agenda' && (
        <AgendaView
          areas={data.areas}
          lifters={data.lifters}
          projects={data.projects}
          contexts={data.contexts}
          tasks={data.tasks}
          workBlocks={data.workBlocks}
          onAdd={addWorkBlock}
          onUpdate={updateWorkBlock}
          onDelete={deleteWorkBlock}
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
              <div key={l.id} className="list-item-row">
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
            {rootProjects.length === 0 && (
              <p className="empty-hint">Brak projektów{selectedLifterId ? ' dla tego podobszaru' : ''}</p>
            )}
            <ProjectTree
              projects={rootProjects}
              allProjects={visibleProjects}
              selectedProjectId={selectedProjectId}
              onSelect={id => { setSelectedProjectId(id); setSelectedTaskId(null); }}
              onDelete={deleteProject}
              onEdit={openProjectEdit}
            />
          </div>
        </section>

        {/* Column 3: Tasks */}
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
            <h2 id="column-header-tasks">Zadania</h2>
            <button
              onClick={e => { e.stopPropagation(); setModal('task'); }}
              style={!selectedProjectId ? { visibility: 'hidden' } : {}}
            >+</button>
          </div>
          <div
            className="column-body"
            id="column-body-tasks"
            role="region"
            aria-labelledby="column-header-tasks"
          >
            {!selectedProjectId && <p className="empty-hint">Wybierz projekt, aby zobaczyć zadania</p>}
            {selectedProjectId && tasks.length === 0 && <p className="empty-hint">Brak zadań w tym projekcie</p>}
            {tasks.map(task => {
              const ctx = data.contexts.find(c => c.id === task.contextId);
              return (
                <div
                  key={task.id}
                  className={`task-item ${task.done ? 'done' : ''} ${task.id === selectedTaskId ? 'selected' : ''}`}
                  onClick={() => selectTask(task.id)}
                >
                  <div className="task-main">
                    <input
                      type="checkbox"
                      checked={task.done}
                      onChange={() => updateTask(task.id, { done: !task.done })}
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
        </section>

        {/* Column 4: Task Detail Panel / Item Edit Panel */}
        {selectedTask && (
          <TaskDetailPanel
            task={selectedTask}
            contexts={data.contexts}
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
          return project ? (
            <ItemDetailPanel
              title="Projekt"
              name={project.name}
              onRename={n => renameProject(editingProjectId, n)}
              onDelete={() => { deleteProject(editingProjectId); setEditingProjectId(null); }}
              onClose={() => setEditingProjectId(null)}
            />
          ) : null;
        })()}
      </main>

      {modal === 'area' && <AddItemModal title="Nowy obszar" placeholder="np. Finanse" onAdd={addArea} onClose={() => setModal(null)} />}
      {modal === 'lifter' && <AddItemModal title="Nowy podobszar" placeholder="np. Samochód" onAdd={addLifter} onClose={() => setModal(null)} />}
      {modal === 'project' && <AddItemModal title="Nowy projekt" placeholder="np. Remont łazienki" onAdd={n => addProject(n)} onClose={() => setModal(null)} />}
      {modal === 'subproject' && <AddItemModal title="Nowy podprojekt" placeholder="np. Kafelki" onAdd={n => addProject(n, selectedProjectId)} onClose={() => setModal(null)} />}
      {modal === 'task' && <AddItemModal title="Nowe zadanie" placeholder="np. Kup materiały" onAdd={addTask} onClose={() => setModal(null)} />}
      {modal === 'settings' && (
        <SettingsModal
          areas={data.areas}
          lifters={data.lifters}
          contexts={data.contexts}
          onDeleteArea={deleteArea}
          onDeleteLifter={deleteLifter}
          onReorderAreas={reorderAreas}
          onAddContext={addContext}
          onDeleteContext={deleteContext}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
