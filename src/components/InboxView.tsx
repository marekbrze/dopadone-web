import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { Task, Project, Context, Area, Lifter } from '../types';
import { PlannedDatePicker } from './PlannedDatePicker';
import { TaskDetailPanel } from './TaskDetailPanel';
import { ConfirmModal } from './ConfirmModal';

interface Props {
  tasks: Task[];
  projects: Project[];
  areas: Area[];
  lifters: Lifter[];
  contexts: Context[];
  onAddTask: (name: string) => void;
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
  onDeleteTask: (id: string) => void;
  onAssignToProject: (taskId: string, projectId: string, clampEndDate?: boolean) => void;
}

export function InboxView({ tasks, projects, areas, lifters, contexts, onAddTask, onUpdateTask, onDeleteTask, onAssignToProject }: Props) {
  const [newTaskName, setNewTaskName] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [showDone, setShowDone] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const [assignConfirm, setAssignConfirm] = useState<{ taskId: string; projectId: string; projectName: string; projectEndDate: string; taskEndDate: string } | null>(null);
  const today = useMemo(() => new Date().toISOString().slice(0, 10), []);

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
              areas={areas}
              lifters={lifters}
              today={today}
              selected={selectedTaskId === task.id}
              onSelect={() => setSelectedTaskId(prev => prev === task.id ? null : task.id)}
              onToggleDone={() => onUpdateTask(task.id, { done: !task.done })}
              onAssign={projectId => handleAssign(task, projectId)}
              onUpdateTask={onUpdateTask}
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
                    areas={areas}
                    lifters={lifters}
                    today={today}
                    selected={selectedTaskId === task.id}
                    onSelect={() => setSelectedTaskId(prev => prev === task.id ? null : task.id)}
                    onToggleDone={() => onUpdateTask(task.id, { done: !task.done })}
                    onAssign={projectId => handleAssign(task, projectId)}
                    onUpdateTask={onUpdateTask}
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
  areas: Area[];
  lifters: Lifter[];
  today: string;
  selected: boolean;
  onSelect: () => void;
  onToggleDone: () => void;
  onAssign: (projectId: string) => void;
  onUpdateTask: (id: string, updates: Partial<Task>) => void;
}

type InboxProjectGroup = {
  areaId: string; areaName: string;
  lifterId: string | null; lifterName: string | null;
  projects: Project[];
};

function buildInboxGroups(projects: Project[], areas: Area[], lifters: Lifter[]): InboxProjectGroup[] {
  const groups: InboxProjectGroup[] = [];
  const sorted = [...projects].sort((a, b) => {
    const areaA = areas.find(ar => ar.id === a.areaId);
    const areaB = areas.find(ar => ar.id === b.areaId);
    const orderA = areaA?.order ?? 999;
    const orderB = areaB?.order ?? 999;
    if (orderA !== orderB) return orderA - orderB;
    if (a.areaId !== b.areaId) return a.areaId.localeCompare(b.areaId);
    if (a.lifterId !== b.lifterId) return (a.lifterId ?? '').localeCompare(b.lifterId ?? '');
    return (a.order ?? 0) - (b.order ?? 0);
  });
  sorted.forEach(project => {
    let group = groups.find(g => g.areaId === project.areaId && g.lifterId === project.lifterId);
    if (!group) {
      const area = areas.find(a => a.id === project.areaId);
      const lifter = project.lifterId ? lifters.find(l => l.id === project.lifterId) : null;
      group = { areaId: project.areaId, areaName: area?.name ?? '—', lifterId: project.lifterId, lifterName: lifter?.name ?? null, projects: [] };
      groups.push(group);
    }
    group.projects.push(project);
  });
  return groups;
}

function ProjectPicker({ projects, areas, lifters, onAssign }: { projects: Project[]; areas: Area[]; lifters: Lifter[]; onAssign: (id: string) => void }) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);

  const filtered = query.trim()
    ? projects.filter(p => p.name.toLowerCase().includes(query.toLowerCase()))
    : projects;

  const groups = useMemo(() => buildInboxGroups(filtered, areas, lifters), [filtered, areas, lifters]);

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
        <>
          <div className="inbox-picker-backdrop" onMouseDown={close} />
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
              {groups.length === 0
                ? <div className="inbox-project-option-empty">Brak wyników</div>
                : groups.map(group => (
                  <div key={`${group.areaId}-${group.lifterId ?? ''}`}>
                    <div className="inbox-project-group-header">
                      {group.areaName}{group.lifterName ? ` / ${group.lifterName}` : ''}
                    </div>
                    {group.projects.map(p => (
                      <div
                        key={p.id}
                        className="inbox-project-option"
                        onMouseDown={() => { onAssign(p.id); close(); }}
                      >
                        {p.name}
                      </div>
                    ))}
                  </div>
                ))
              }
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function InboxTaskRow({ task, projects, areas, lifters, today, selected, onSelect, onToggleDone, onAssign, onUpdateTask }: RowProps) {
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
      <PlannedDatePicker
        date={task.plannedDate}
        isNext={task.isNext}
        today={today}
        onChange={(date, isNext) => onUpdateTask(task.id, { plannedDate: date, isNext: isNext ?? false })}
      />
      <ProjectPicker projects={projects} areas={areas} lifters={lifters} onAssign={onAssign} />
    </div>
  );
}
