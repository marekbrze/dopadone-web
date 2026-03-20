import { useState, useEffect, useRef } from 'react';
import type { Task, Context } from '../types';
import { TaskDetailPanel } from './TaskDetailPanel';

const STORAGE_KEY = 'dopadone-doing-groups';

interface GroupPref {
  contextId: string | null;
  hidden: boolean;
}

function loadPrefs(contexts: Context[]): GroupPref[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const saved = JSON.parse(raw) as GroupPref[];
      // Merge: keep saved order/hidden, append new contexts at end
      const savedIds = new Set(saved.map(p => p.contextId === null ? '__null__' : p.contextId));
      const newEntries: GroupPref[] = contexts
        .filter(c => !savedIds.has(c.id))
        .map(c => ({ contextId: c.id, hidden: false }));
      if (!savedIds.has('__null__')) newEntries.push({ contextId: null, hidden: false });
      return [...saved, ...newEntries];
    }
  } catch {
    // ignore
  }
  // Default: one group per context + null at end
  return [
    ...contexts.map(c => ({ contextId: c.id, hidden: false })),
    { contextId: null, hidden: false },
  ];
}

function savePrefs(prefs: GroupPref[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
}

interface Props {
  tasks: Task[];
  contexts: Context[];
  onUpdateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  onDeleteTask: (id: string) => Promise<void>;
  onCompleteWithNextAction: (task: Task, nextActionName: string) => Promise<void>;
}

export function DoingView({ tasks, contexts, onUpdateTask, onDeleteTask, onCompleteWithNextAction }: Props) {
  const [groupPrefs, setGroupPrefs] = useState<GroupPref[]>(() => loadPrefs(contexts));
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const prevContextsRef = useRef(contexts);

  // Merge new contexts into prefs when contexts change
  useEffect(() => {
    if (prevContextsRef.current === contexts) return;
    prevContextsRef.current = contexts;
    setGroupPrefs(prev => {
      const existingIds = new Set(prev.map(p => p.contextId === null ? '__null__' : p.contextId));
      const newEntries: GroupPref[] = contexts
        .filter(c => !existingIds.has(c.id))
        .map(c => ({ contextId: c.id, hidden: false }));
      if (newEntries.length === 0) return prev;
      return [...prev, ...newEntries];
    });
  }, [contexts]);

  const activeTasks = tasks.filter(t => !t.done);

  const toggleGroup = (index: number) => {
    setGroupPrefs(prev => {
      const next = prev.map((p, i) => i === index ? { ...p, hidden: !p.hidden } : p);
      savePrefs(next);
      return next;
    });
  };

  const handleDragStart = (index: number) => {
    setDragIndex(index);
  };

  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };

  const handleDrop = (toIndex: number) => {
    if (dragIndex === null || dragIndex === toIndex) {
      setDragIndex(null);
      setDragOverIndex(null);
      return;
    }
    setGroupPrefs(prev => {
      const next = [...prev];
      const [moved] = next.splice(dragIndex, 1);
      next.splice(toIndex, 0, moved);
      savePrefs(next);
      return next;
    });
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const selectedTask = activeTasks.find(t => t.id === selectedTaskId) ?? null;

  // If selected task was completed or deleted, deselect
  useEffect(() => {
    if (selectedTaskId && !activeTasks.find(t => t.id === selectedTaskId)) {
      setSelectedTaskId(null);
    }
  }, [activeTasks, selectedTaskId]);

  return (
    <div className="doing-view">
      <div className="doing-layout">
        <div className="doing-board">
          {/* Fixed "Blokuje" column — always first */}
          {(() => {
            const blockingTasks = activeTasks.filter(t => t.blocking);
            return (
              <div className="doing-col doing-col-blocking">
                <div className="doing-col-header">
                  <span className="doing-col-name">🔴 Blokuje</span>
                  <span className="doing-col-count">{blockingTasks.length}</span>
                </div>
                <div className="doing-col-body">
                  {blockingTasks.length === 0 ? (
                    <div className="doing-empty">Brak blokujących zadań</div>
                  ) : (
                    blockingTasks.map(task => (
                      <div
                        key={task.id}
                        className={`task-item${task.id === selectedTaskId ? ' selected' : ''}`}
                        onClick={() => setSelectedTaskId(prev => prev === task.id ? null : task.id)}
                      >
                        <div className="task-main">
                          <input
                            type="checkbox"
                            checked={task.done}
                            onChange={() => onUpdateTask(task.id, { done: !task.done })}
                            onClick={e => e.stopPropagation()}
                          />
                          <span className="task-name">{task.name}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            );
          })()}

          {groupPrefs.map((pref, index) => {
            const ctx = pref.contextId ? contexts.find(c => c.id === pref.contextId) : null;
            if (pref.contextId !== null && !ctx) return null;

            const groupTasks = activeTasks.filter(t =>
              pref.contextId === null ? t.contextId === null : t.contextId === pref.contextId
            );

            const label = ctx ? `${ctx.icon} ${ctx.name}` : 'Bez kontekstu';

            return (
              <div
                key={pref.contextId ?? '__null__'}
                className={`doing-col${pref.hidden ? ' hidden' : ''}${dragOverIndex === index ? ' drag-over' : ''}`}
                draggable
                onDragStart={() => handleDragStart(index)}
                onDragOver={e => handleDragOver(e, index)}
                onDrop={() => handleDrop(index)}
                onDragEnd={handleDragEnd}
              >
                <div className="doing-col-header" onClick={() => toggleGroup(index)}>
                  <span className="doing-drag-handle" onMouseDown={e => e.stopPropagation()}>⠿</span>
                  <span className="doing-col-name">{label}</span>
                  <span className="doing-col-count">{groupTasks.length}</span>
                  <span className="doing-col-toggle">{pref.hidden ? '▸' : '▾'}</span>
                </div>
                {!pref.hidden && (
                  <div className="doing-col-body">
                    {groupTasks.length === 0 ? (
                      <div className="doing-empty">Brak zadań</div>
                    ) : (
                      groupTasks.map(task => (
                        <div
                          key={task.id}
                          className={`task-item${task.id === selectedTaskId ? ' selected' : ''}`}
                          onClick={() => setSelectedTaskId(prev => prev === task.id ? null : task.id)}
                        >
                          <div className="task-main">
                            <input
                              type="checkbox"
                              checked={task.done}
                              onChange={() => onUpdateTask(task.id, { done: !task.done })}
                              onClick={e => e.stopPropagation()}
                            />
                            <span className="task-name">{task.name}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {selectedTask && (
          <TaskDetailPanel
            task={selectedTask}
            contexts={contexts}
            onUpdate={(key, value) => onUpdateTask(selectedTask.id, { [key]: value })}
            onDelete={() => { onDeleteTask(selectedTask.id); setSelectedTaskId(null); }}
            onClose={() => setSelectedTaskId(null)}
            onCompleteWithNextAction={(name) => onCompleteWithNextAction(selectedTask, name)}
          />
        )}
      </div>
    </div>
  );
}
