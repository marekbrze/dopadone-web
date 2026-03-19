import { useState, useEffect } from 'react';
import type { AppState, Project, Task, Effort } from './types';
import { loadData, saveData } from './data';
import { AddItemModal } from './components/AddItemModal';
import { ProjectTree } from './components/ProjectTree';
import { ContextsPanel } from './components/ContextsPanel';
import './App.css';

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

const EFFORTS: { value: Effort; label: string }[] = [
  { value: 'xs', label: 'XS' },
  { value: 's', label: 'S' },
  { value: 'm', label: 'M' },
  { value: 'l', label: 'L' },
  { value: 'xl', label: 'XL' },
];

export default function App() {
  const [data, setData] = useState<AppState>(loadData);
  const [selectedAreaId, setSelectedAreaId] = useState<string>(data.areas[0]?.id ?? '');
  const [selectedLifterId, setSelectedLifterId] = useState<string | null>(null);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [modal, setModal] = useState<null | 'area' | 'lifter' | 'project' | 'subproject' | 'task' | 'contexts'>(null);
  const [editingTask, setEditingTask] = useState<string | null>(null);
  const [editingTaskName, setEditingTaskName] = useState('');

  useEffect(() => { saveData(data); }, [data]);

  const selectArea = (id: string) => {
    setSelectedAreaId(id);
    setSelectedLifterId(null);
    setSelectedProjectId(null);
  };

  const selectLifter = (id: string) => {
    setSelectedLifterId(prev => prev === id ? null : id);
    setSelectedProjectId(null);
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

  const selectedArea = data.areas.find(a => a.id === selectedAreaId);

  // Area / lifter / project
  const addArea = (name: string) => {
    const colors = ['#9C27B0', '#FF9800', '#009688', '#F44336', '#3F51B5'];
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

  const toggleTask = (taskId: string) => {
    setData(d => ({ ...d, tasks: d.tasks.map(t => t.id === taskId ? { ...t, done: !t.done } : t) }));
  };

  const deleteTask = (taskId: string) => {
    setData(d => ({ ...d, tasks: d.tasks.filter(t => t.id !== taskId) }));
  };

  const updateTask = <K extends keyof Task>(taskId: string, key: K, value: Task[K]) => {
    setData(d => ({ ...d, tasks: d.tasks.map(t => t.id === taskId ? { ...t, [key]: value } : t) }));
  };

  const startEditTask = (task: Task) => {
    setEditingTask(task.id);
    setEditingTaskName(task.name);
  };

  const saveEditTask = () => {
    if (!editingTask) return;
    updateTask(editingTask, 'name', editingTaskName);
    setEditingTask(null);
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

  const priorityColors: Record<Task['priority'], string> = {
    low: '#8BC34A',
    medium: '#FF9800',
    high: '#F44336',
  };

  const priorityLabels: Record<Task['priority'], string> = {
    low: 'Niska',
    medium: 'Średnia',
    high: 'Wysoka',
  };

  return (
    <div className="app">
      <header className="app-header">
        <div className="logo">DoPaDone</div>
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
        <button className="settings-btn" onClick={() => setModal('contexts')} title="Zarządzaj kontekstami">
          ⚙ Konteksty
        </button>
      </header>

      <main className="columns">
        {/* Column 1: Lifters */}
        <section className="column">
          <div className="column-header" style={{ borderTopColor: selectedArea?.color }}>
            <h2>Podobszary</h2>
            <button onClick={() => setModal('lifter')}>+</button>
          </div>
          <div className="column-body">
            {lifters.length === 0 && <p className="empty-hint">Brak podobszarów w tym obszarze</p>}
            {lifters.map(l => (
              <div
                key={l.id}
                className={`list-item ${selectedLifterId === l.id ? 'selected' : ''}`}
                onClick={() => selectLifter(l.id)}
                style={selectedLifterId === l.id ? { borderLeftColor: selectedArea?.color } : {}}
              >
                {l.name}
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
              onSelect={id => setSelectedProjectId(prev => prev === id ? null : id)}
            />
          </div>
        </section>

        {/* Column 3: Tasks */}
        <section className="column">
          <div className="column-header" style={{ borderTopColor: selectedArea?.color }}>
            <h2>Zadania</h2>
            {selectedProjectId && <button onClick={() => setModal('task')}>+</button>}
          </div>
          <div className="column-body">
            {!selectedProjectId && <p className="empty-hint">Wybierz projekt, aby zobaczyć zadania</p>}
            {selectedProjectId && tasks.length === 0 && <p className="empty-hint">Brak zadań w tym projekcie</p>}
            {tasks.map(task => {
              const ctx = data.contexts.find(c => c.id === task.contextId);
              return (
                <div key={task.id} className={`task-item ${task.done ? 'done' : ''}`}>
                  {/* Row 1: checkbox + name */}
                  <div className="task-main">
                    <input type="checkbox" checked={task.done} onChange={() => toggleTask(task.id)} />
                    {editingTask === task.id ? (
                      <input
                        className="task-edit-input"
                        value={editingTaskName}
                        onChange={e => setEditingTaskName(e.target.value)}
                        onBlur={saveEditTask}
                        onKeyDown={e => { if (e.key === 'Enter') saveEditTask(); if (e.key === 'Escape') setEditingTask(null); }}
                        autoFocus
                      />
                    ) : (
                      <span className="task-name" onDoubleClick={() => startEditTask(task)}>{task.name}</span>
                    )}
                    <button className="delete-btn" onClick={() => deleteTask(task.id)}>✕</button>
                  </div>

                  {/* Row 2: meta controls */}
                  <div className="task-meta">
                    {/* Priority */}
                    <select
                      className="meta-select priority-select"
                      value={task.priority}
                      onChange={e => updateTask(task.id, 'priority', e.target.value as Task['priority'])}
                      style={{ color: priorityColors[task.priority] }}
                    >
                      {(['high', 'medium', 'low'] as Task['priority'][]).map(p => (
                        <option key={p} value={p}>{priorityLabels[p]}</option>
                      ))}
                    </select>

                    {/* Effort */}
                    <div className="effort-pills">
                      {EFFORTS.map(e => (
                        <button
                          key={e.value}
                          className={`effort-pill ${task.effort === e.value ? 'active' : ''}`}
                          onClick={() => updateTask(task.id, 'effort', task.effort === e.value ? null : e.value)}
                        >
                          {e.label}
                        </button>
                      ))}
                    </div>

                    {/* Context */}
                    <select
                      className="meta-select context-select"
                      value={task.contextId ?? ''}
                      onChange={e => updateTask(task.id, 'contextId', e.target.value || null)}
                    >
                      <option value="">— kontekst —</option>
                      {data.contexts.map(c => (
                        <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                      ))}
                    </select>
                  </div>

                  {/* Tags row */}
                  {(task.effort || ctx) && (
                    <div className="task-tags">
                      {task.effort && <span className="tag effort-tag">{task.effort.toUpperCase()}</span>}
                      {ctx && <span className="tag context-tag">{ctx.icon} {ctx.name}</span>}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>
      </main>

      {modal === 'area' && <AddItemModal title="Nowy obszar" placeholder="np. Finanse" onAdd={addArea} onClose={() => setModal(null)} />}
      {modal === 'lifter' && <AddItemModal title="Nowy podobszar" placeholder="np. Samochód" onAdd={addLifter} onClose={() => setModal(null)} />}
      {modal === 'project' && <AddItemModal title="Nowy projekt" placeholder="np. Remont łazienki" onAdd={n => addProject(n)} onClose={() => setModal(null)} />}
      {modal === 'subproject' && <AddItemModal title="Nowy podprojekt" placeholder="np. Kafelki" onAdd={n => addProject(n, selectedProjectId)} onClose={() => setModal(null)} />}
      {modal === 'task' && <AddItemModal title="Nowe zadanie" placeholder="np. Kup materiały" onAdd={addTask} onClose={() => setModal(null)} />}
      {modal === 'contexts' && (
        <ContextsPanel
          contexts={data.contexts}
          onAdd={addContext}
          onDelete={deleteContext}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
