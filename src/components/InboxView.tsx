import { useState, useRef, useEffect, useCallback } from 'react';
import type { Task, Project, Context } from '../types';
import { TaskDetailPanel } from './TaskDetailPanel';
import { ConfirmModal } from './ConfirmModal';

interface Props {
  tasks: Task[];
  projects: Project[];
  contexts: Context[];
  onAddTask: (name: string) => void;
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onDeleteTask: (id: string) => void;
  onAssignToProject: (taskId: string, projectId: string, clampEndDate?: boolean) => void;
}

export function InboxView({ tasks, projects, contexts, onAddTask, onUpdateTask, onDeleteTask, onAssignToProject }: Props) {
  const [newTaskName, setNewTaskName] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [assignConfirm, setAssignConfirm] = useState<{ taskId: string; projectId: string; projectName: string; projectEndDate: string; taskEndDate: string } | null>(null);

  const undone = tasks.filter(t => !t.done);
  const done = tasks.filter(t => t.done);
  const selectedTask = tasks.find(t => t.id === selectedTaskId) ?? null;

  useEffect(() => {
    if (selectedTaskId && !tasks.find(t => t.id === selectedTaskId)) {
      setSelectedTaskId(null);
    }
  }, [tasks, selectedTaskId]);

  const handleAdd = () => {
    const name = newTaskName.trim();
    if (!name) return;
    onAddTask(name);
    setNewTaskName('');
    inputRef.current?.focus();
  };

  const handleAssign = (task: Task, projectId: string) => {
    const project = projects.find(p => p.id === projectId);
    if (task.endDate && project?.endDate && task.endDate > project.endDate) {
      setAssignConfirm({ taskId: task.id, projectId, projectName: project.name, projectEndDate: project.endDate, taskEndDate: task.endDate });
      return;
    }
    onAssignToProject(task.id, projectId);
  };

  return (
    <div className="inbox-view">
      <div className={`inbox-main${selectedTask ? ' panel-open' : ''}`}>
        <div className="inbox-header">
          <h1 className="inbox-title">Inbox</h1>
          <span className="inbox-count">{undone.length} {undone.length === 1 ? 'zadanie' : undone.length < 5 ? 'zadania' : 'zadań'}</span>
        </div>

        <div className="inbox-add-row">
          <input
            ref={inputRef}
            type="text"
            className="inbox-add-input"
            placeholder="Dodaj zadanie do Inboxu..."
            value={newTaskName}
            onChange={e => setNewTaskName(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            autoFocus
          />
          <button className="inbox-add-btn" onClick={handleAdd} disabled={!newTaskName.trim()}>Dodaj</button>
        </div>

        <div className="inbox-list">
          {undone.length === 0 && (
            <p className="inbox-empty">Inbox pusty — dodaj zadania powyżej lub skrótem Cmd+Shift+Spacja</p>
          )}
          {undone.map(task => (
            <InboxTaskRow
              key={task.id}
              task={task}
              projects={projects}
              selected={selectedTaskId === task.id}
              onSelect={() => setSelectedTaskId(prev => prev === task.id ? null : task.id)}
              onToggleDone={() => onUpdateTask(task.id, { done: !task.done })}
              onAssign={projectId => handleAssign(task, projectId)}
            />
          ))}
        </div>

        {done.length > 0 && (
          <div className="inbox-done-section">
            <button
              className="inbox-done-toggle"
              onClick={() => setShowDone(v => !v)}
            >
              {showDone ? '▾' : '▸'} Ukończone ({done.length})
            </button>
            {showDone && (
              <div className="inbox-list inbox-list-done">
                {done.map(task => (
                  <InboxTaskRow
                    key={task.id}
                    task={task}
                    projects={projects}
                    selected={selectedTaskId === task.id}
                    onSelect={() => setSelectedTaskId(prev => prev === task.id ? null : task.id)}
                    onToggleDone={() => onUpdateTask(task.id, { done: !task.done })}
                    onAssign={projectId => handleAssign(task, projectId)}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {selectedTask && (
        <TaskDetailPanel
          task={selectedTask}
          contexts={contexts}
          onUpdate={(key, value) => onUpdateTask(selectedTask.id, { [key]: value })}
          onDelete={() => { onDeleteTask(selectedTask.id); setSelectedTaskId(null); }}
          onClose={() => setSelectedTaskId(null)}
          onCompleteWithNextAction={name => {
            onUpdateTask(selectedTask.id, { done: true });
            onAddTask(name);
          }}
        />
      )}

      {assignConfirm && (
        <ConfirmModal
          title="Konflikt dat"
          message={`Data zakończenia zadania (${assignConfirm.taskEndDate}) jest późniejsza niż data zakończenia projektu „${assignConfirm.projectName}" (${assignConfirm.projectEndDate}). Data zakończenia zadania zostanie zmieniona na ${assignConfirm.projectEndDate}.`}
          onConfirm={() => {
            onAssignToProject(assignConfirm.taskId, assignConfirm.projectId, true);
            setAssignConfirm(null);
          }}
          onCancel={() => setAssignConfirm(null)}
        />
      )}
    </div>
  );
}

interface RowProps {
  task: Task;
  projects: Project[];
  selected: boolean;
  onSelect: () => void;
  onToggleDone: () => void;
  onAssign: (projectId: string) => void;
}

function ProjectPicker({ projects, onAssign }: { projects: Project[]; onAssign: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? projects.filter(p => p.name.toLowerCase().includes(query.toLowerCase()))
    : projects;

  const close = useCallback(() => { setOpen(false); setQuery(''); }, []);

  useEffect(() => {
    if (!open) return;
    searchRef.current?.focus();
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) close();
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open, close]);

  return (
    <div className="inbox-project-picker" ref={ref} onClick={e => e.stopPropagation()}>
      <button
        className="inbox-project-picker-btn"
        onClick={() => setOpen(v => !v)}
        title="Przypisz do projektu"
      >
        Przypisz...
      </button>
      {open && (
        <div className="inbox-project-dropdown">
          <input
            ref={searchRef}
            className="inbox-project-search"
            placeholder="Szukaj projektu..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') close(); }}
          />
          <div className="inbox-project-list">
            {filtered.length === 0
              ? <div className="inbox-project-option-empty">Brak wyników</div>
              : filtered.map(p => (
                <div
                  key={p.id}
                  className="inbox-project-option"
                  onMouseDown={() => { onAssign(p.id); close(); }}
                >
                  {p.name}
                </div>
              ))
            }
          </div>
        </div>
      )}
    </div>
  );
}

function InboxTaskRow({ task, projects, selected, onSelect, onToggleDone, onAssign }: RowProps) {
  return (
    <div className={`inbox-task-row${selected ? ' selected' : ''}`} onClick={onSelect}>
      <input
        type="checkbox"
        checked={task.done}
        onChange={onToggleDone}
        onClick={e => e.stopPropagation()}
        className="inbox-task-checkbox"
      />
      <span className="inbox-task-name">{task.name}</span>
      <ProjectPicker projects={projects} onAssign={onAssign} />
    </div>
  );
}
