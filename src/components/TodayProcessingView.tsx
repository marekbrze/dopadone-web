import { useState, useEffect, useCallback } from 'react';
import type { Task, Project } from '../types';
import { addDays, formatPlannedDate, getDateOptions, type DateOption } from './dateStepUtils';
import './ProcessingView.css';

interface TodayProcessingViewProps {
  tasks: Task[];
  projects: Project[];
  today: string;
  onUpdateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  onDone: () => void;
}

export function TodayProcessingView({ tasks, projects, today, onUpdateTask, onDone }: TodayProcessingViewProps) {
  const [idx, setIdx] = useState(0);
  const [pendingKey, setPendingKey] = useState<string | null>(null);
  const [history, setHistory] = useState<{ taskId: string; action: string }[]>([]);

  const dateOptions = getDateOptions(today);

  const goNext = useCallback((action: string, taskId: string) => {
    setHistory(h => [...h, { taskId, action }]);
    setPendingKey(null);
    if (idx + 1 >= tasks.length) {
      onDone();
    } else {
      setIdx(idx + 1);
    }
  }, [idx, tasks.length, onDone]);

  const goBack = useCallback(() => {
    if (idx === 0) return;
    setIdx(idx - 1);
    setPendingKey(null);
  }, [idx]);

  const pickDate = useCallback(async (opt: DateOption) => {
    const task = tasks[idx];
    if (!task) return;
    await onUpdateTask(task.id, {
      plannedDate: opt.date,
      isNext: opt.isNext ? true : false,
    });
    goNext('date', task.id);
  }, [tasks, idx, onUpdateTask, goNext]);

  const markDone = useCallback(async () => {
    const task = tasks[idx];
    if (!task) return;
    await onUpdateTask(task.id, { done: true });
    goNext('done', task.id);
  }, [tasks, idx, onUpdateTask, goNext]);

  const skip = useCallback(() => {
    const task = tasks[idx];
    if (!task) return;
    goNext('skip', task.id);
  }, [tasks, idx, goNext]);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable) return;

      if (e.key === 'd') { markDone(); return; }
      if (e.key === 's') { skip(); return; }
      if (e.key === 'ArrowLeft') { goBack(); return; }
      if (e.key === 'Enter' && pendingKey) {
        e.preventDefault();
        const opt = dateOptions.find(o => o.key === pendingKey);
        if (opt) pickDate(opt);
        return;
      }

      const opt = dateOptions.find(o => o.key === e.key);
      if (opt) {
        if (pendingKey === opt.key) {
          pickDate(opt);
        } else {
          setPendingKey(opt.key);
        }
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [markDone, skip, goBack, pendingKey, dateOptions, pickDate]);

  if (tasks.length === 0) {
    onDone();
    return null;
  }

  const task = tasks[idx];
  if (!task) return null;

  const project = task.projectId ? projects.find(p => p.id === task.projectId) : null;
  const priorityColors: Record<string, string> = { low: '#5a7a5e', medium: '#a07830', high: '#a33a2a' };

  return (
    <div className="processing-view">
      <div className="tp-shell">
        {/* Counter */}
        <div className="tp-counter">{idx + 1}/{tasks.length}</div>

        {/* Task card */}
        <div className="tp-task-card">
          <div className="tp-task-name">{task.name}</div>
          <div className="tp-task-meta">
            {project && <span className="tp-task-project">{project.name}</span>}
            <span className="tp-task-priority" style={{ color: priorityColors[task.priority] }}>
              {task.priority === 'low' ? 'Niski' : task.priority === 'medium' ? 'Średni' : 'Wysoki'}
            </span>
            {task.plannedDate && (
              <span className="tp-task-date">
                {task.plannedDate === today ? 'Dziś' : formatPlannedDate(task.plannedDate, today)}
              </span>
            )}
            {task.isNext && <span className="tp-task-date">Następne</span>}
          </div>
        </div>

        {/* Date grid */}
        <div className="proc-option-step proc-date-step">
          <div className="proc-step-hint">
            Wybierz klawiszem lub klikiem, potwierdź <kbd>↵</kbd>
          </div>
          <div className="proc-options-grid">
            {dateOptions.map(opt => {
              const hint = opt.date && opt.date !== today && opt.date !== addDays(today, 1)
                ? formatPlannedDate(opt.date, today) : null;
              return (
                <button
                  key={opt.key}
                  className={`proc-option-card${pendingKey === opt.key ? ' highlighted' : ''}${opt.isNext ? ' proc-option-next' : ''}`}
                  onMouseEnter={() => setPendingKey(opt.key)}
                  onClick={() => {
                    if (pendingKey === opt.key) {
                      pickDate(opt);
                    } else {
                      setPendingKey(opt.key);
                    }
                  }}
                >
                  <span className="proc-option-label">{opt.label}</span>
                  {hint && <span className="proc-option-date-hint">{hint}</span>}
                  <span className="proc-option-key">{opt.key}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Action buttons */}
        <div className="tp-actions">
          <button className="tp-action-btn tp-done-btn" onClick={markDone}>
            Zakończ <kbd>d</kbd>
          </button>
          <button className="tp-action-btn tp-skip-btn" onClick={skip}>
            Pomiń <kbd>s</kbd>
          </button>
          {idx > 0 && (
            <button className="tp-action-btn tp-back-btn" onClick={goBack}>
              Cofnij <kbd>←</kbd>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
