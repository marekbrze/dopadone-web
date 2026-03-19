import { useState, useEffect } from 'react';
import type { AppState, Project, Task } from './types';
import { loadData, saveData } from './data';
import { AddItemModal } from './components/AddItemModal';
import { ProjectTree } from './components/ProjectTree';
import { SettingsModal } from './components/SettingsModal';
import { TaskDetailPanel } from './components/TaskDetailPanel';
import './App.css';

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const priorityColors: Record<Task['priority'], string> = {
  low: '#5a7a5e',
  medium: '#a07830',
  high: '#a33a2a',
};

export default function App() {
  const [data, setData] = useState<AppState>(loadData);
  const [selectedAreaId, setSelectedAreaId] = useState<string>(data.areas[0]?.id ?? '');
  const [selectedLifterId, setSelectedLifterId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [modal, setModal] = useState<null | 'area' | 'lifter' | 'project' | 'subproject' | 'task' | 'settings'>(null);

  useEffect(() => { saveData(data); }, [data]);

  const selectArea = (id: string) => {
    setSelectedAreaId(id);
    setSelectedLifterId(null);
    setSelectedProjectId(null);
    setSelectedTaskId(null);
  };

  const selectLifter = (id: string) => {
    setSelectedLifterId(prev => prev === id ? null : id);
    setSelectedProjectId(null);
    setSelectedTaskId(null);
  };

  const selectTask = (id: string) => {
    setSelectedTaskId(prev => prev === id ? null : id);
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
  const addArea = (name: string) => {
    const colors = ['#5c4a38', '#4a6852', '#6b5230', '#4a5c68', '#7a5c48'];
    const color = colors[data.areas.length % colors.length];
    setData(d => ({ ...d, areas: [...d.areas, { id: uid(), name, color }] }));
  };

  const addLifter = (name: string) => {
    setData(d => ({ ...d, lifters: [...d.lifters, { id: uid(), name, areaId: selectedAreaId }] }));
  };

  const addProject = (name: string, parentProjectId: string | null = null) => {
    const proj: Project = { id: uid(), name, areaId: selectedAreaId, lifterId: selectedLifterId, parentProjectId };
    setData(d => ({ ...d, projects: [...d.projects, proj] }));
  };

  // Tasks
  const addTask = (name: string) => {
    if (!selectedProjectId) return;
    const task: Task = { id: uid(), name, projectId: selectedProjectId, done: false, priority: 'medium', notes: '', effort: null, contextId: null };
    setData(d => ({ ...d, tasks: [...d.tasks, task] }));
  };

  const deleteTask = (taskId: string) => {
    setData(d => ({ ...d, tasks: d.tasks.filter(t => t.id !== taskId) }));
  };

  const updateTask = (taskId: string, updates: Partial<Task>) => {
    setData(d => ({ ...d, tasks: d.tasks.map(t => t.id === taskId ? { ...t, ...updates } : t) }));
  };

  // Helpers
  function collectProjectIds(rootId: string, allProjects: Project[]): string[] {
    const children = allProjects.filter(p => p.parentProjectId === rootId);
    return [rootId, ...children.flatMap(c => collectProjectIds(c.id, allProjects))];
  }

  const deleteProject = (id: string) => {
    const ids = collectProjectIds(id, data.projects);
    setData(d => {
      const idsSet = new Set(collectProjectIds(id, d.projects));
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
  };

  const deleteLifter = (id: string) => {
    setData(d => {
      const rootIds = d.projects.filter(p => p.lifterId === id).map(p => p.id);
      const allIds = new Set(rootIds.flatMap(rid => collectProjectIds(rid, d.projects)));
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
  };

  const deleteArea = (id: string) => {
    setData(d => {
      const lifterIds = d.lifters.filter(l => l.areaId === id).map(l => l.id);
      const rootIds = d.projects.filter(p => p.areaId === id).map(p => p.id);
      const allProjectIds = new Set(rootIds.flatMap(rid => collectProjectIds(rid, d.projects)));
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
    }
  };

  const reorderAreas = (fromIndex: number, toIndex: number) => {
    setData(d => {
      const areas = [...d.areas];
      const [moved] = areas.splice(fromIndex, 1);
      areas.splice(toIndex, 0, moved);
      return { ...d, areas };
    });
  };

  // Contexts
  const addContext = (name: string, icon: string) => {
    setData(d => ({ ...d, contexts: [...d.contexts, { id: uid(), name, icon }] }));
  };

  const deleteContext = (id: string) => {
    setData(d => ({
      ...d,
      contexts: d.contexts.filter(c => c.id !== id),
      tasks: d.tasks.map(t => t.contextId === id ? { ...t, contextId: null } : t),
    }));
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo">Dopadone</div>
        <nav className="area-tabs">
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
        <button className="settings-btn" onClick={() => setModal('settings')} title="Ustawienia">
          ⚙ Ustawienia
        </button>
      </header>

      <main className={`columns${selectedTask ? ' panel-open' : ''}`}>
        {/* Column 1: Lifters */}
        <section className="column">
          <div className="column-header" style={{ borderTopColor: selectedArea?.color }}>
            <h2>Podobszary</h2>
            <button onClick={() => setModal('lifter')}>+</button>
          </div>
          <div className="column-body">
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
                <button className="delete-btn" onClick={e => { e.stopPropagation(); deleteLifter(l.id); }}>✕</button>
              </div>
            ))}
          </div>
        </section>

        {/* Column 2: Projects */}
        <section className="column">
          <div className="column-header" style={{ borderTopColor: selectedArea?.color }}>
            <h2>Projekty</h2>
            <div className="header-actions">
              {selectedProjectId && (
                <button onClick={() => setModal('subproject')} title="Dodaj podprojekt">⤷</button>
              )}
              <button onClick={() => setModal('project')}>+</button>
            </div>
          </div>
          <div className="column-body">
            {rootProjects.length === 0 && (
              <p className="empty-hint">Brak projektów{selectedLifterId ? ' dla tego podobszaru' : ''}</p>
            )}
            <ProjectTree
              projects={rootProjects}
              allProjects={visibleProjects}
              selectedProjectId={selectedProjectId}
              onSelect={id => { setSelectedProjectId(prev => prev === id ? null : id); setSelectedTaskId(null); }}
              onDelete={deleteProject}
            />
          </div>
        </section>

        {/* Column 3: Tasks */}
        <section className="column">
          <div className="column-header" style={{ borderTopColor: selectedArea?.color }}>
            <h2>Zadania</h2>
            <button
              onClick={() => setModal('task')}
              style={!selectedProjectId ? { visibility: 'hidden' } : {}}
            >+</button>
          </div>
          <div className="column-body">
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

        {/* Column 4: Task Detail Panel */}
        {selectedTask && (
          <TaskDetailPanel
            task={selectedTask}
            contexts={data.contexts}
            onUpdate={(key, value) => updateTask(selectedTask.id, { [key]: value })}
            onDelete={() => { deleteTask(selectedTask.id); setSelectedTaskId(null); }}
            onClose={() => setSelectedTaskId(null)}
          />
        )}
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
