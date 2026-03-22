import { useState, useRef, useEffect } from 'react';
import type { Task, Project, Context } from '../types';
import { TaskDetailPanel } from './TaskDetailPanel';

interface Props {
  tasks: Task[];
  projects: Project[];
  contexts: Context[];
  onAddTask: (name: string) => void;
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onDeleteTask: (id: string) => void;
  onAssignToProject: (taskId: string, projectId: string) => void;
}

export function InboxView({ tasks, projects, contexts, onAddTask, onUpdateTask, onDeleteTask, onAssignToProject }: Props) {
  const [newTaskName, setNewTaskName] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

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
              onAssign={projectId => onAssignToProject(task.id, projectId)}
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
                    onAssign={projectId => onAssignToProject(task.id, projectId)}
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
      <select
        className="inbox-task-project-select"
        value=""
        onChange={e => { if (e.target.value) onAssign(e.target.value); e.stopPropagation(); }}
        onClick={e => e.stopPropagation()}
        title="Przypisz do projektu"
      >
        <option value="" disabled>Przypisz...</option>
        {projects.map(p => (
          <option key={p.id} value={p.id}>{p.name}</option>
        ))}
      </select>
    </div>
  );
}
