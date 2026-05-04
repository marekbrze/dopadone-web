import { useState, useEffect, useCallback, useRef } from 'react';
import type { Task, Project } from '../types';
import { formatPlannedDate, getDateOptions, parseDateInput, type DateOption } from './dateStepUtils';
import './ProcessingView.css';
import './TodayProcessingView.css';

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
  const [showParser, setShowParser] = useState(false);
  const [parserText, setParserText] = useState('');
  const taskRef = useRef<HTMLDivElement>(null);
  const parserRef = useRef<HTMLInputElement>(null);

  // Freeze task list on mount so DB updates don't shift the array mid-processing
  const [queue] = useState(() => [...tasks]);
  const total = queue.length;

  const dateOptions = getDateOptions(today);

  const goNext = useCallback(() => {
    setPendingKey(null);
    setShowParser(false);
    setParserText('');
    if (idx + 1 >= total) {
      onDone();
    } else {
      setIdx(idx + 1);
    }
  }, [idx, total, onDone]);

  const goBack = useCallback(() => {
    if (idx === 0) return;
    setIdx(idx - 1);
    setPendingKey(null);
    setShowParser(false);
    setParserText('');
  }, [idx]);

  const pickDate = useCallback(async (opt: DateOption) => {
    const task = queue[idx];
    if (!task) return;
    await onUpdateTask(task.id, {
      plannedDate: opt.date,
      isNext: opt.isNext ? true : false,
    });
    goNext();
  }, [queue, idx, onUpdateTask, goNext]);

  const pickCustomDate = useCallback(async (date: string) => {
    const task = queue[idx];
    if (!task) return;
    await onUpdateTask(task.id, { plannedDate: date, isNext: false });
    goNext();
  }, [queue, idx, onUpdateTask, goNext]);

  const markDone = useCallback(async () => {
    const task = queue[idx];
    if (!task) return;
    await onUpdateTask(task.id, { done: true });
    goNext();
  }, [queue, idx, onUpdateTask, goNext]);

  const skip = useCallback(() => {
    if (!queue[idx]) return;
    goNext();
  }, [queue, idx, goNext]);

  useEffect(() => {
    if (total === 0) { onDone(); return; }
  }, [total, onDone]);

  useEffect(() => {
    taskRef.current?.focus();
  }, [idx]);

  useEffect(() => {
    if (showParser) parserRef.current?.focus();
  }, [showParser]);

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
        if (opt && !opt.isCustom) pickDate(opt);
        return;
      }

      if (e.key === '7') {
        e.preventDefault();
        setShowParser(true);
        setParserText('');
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

  if (total === 0) return null;

  const task = queue[idx];
  if (!task) return null;

  const project = task.projectId ? projects.find(p => p.id === task.projectId) : null;
  const priorityColors: Record<string, string> = { low: '#5a7a5e', medium: '#a07830', high: '#a33a2a' };
  const parsed = parseDateInput(parserText);

  const NO_HINT_LABELS = new Set(['Dziś', 'Jutro', 'Weekend', 'Następny tydzień']);

  return (
    <div className="processing-view" role="region" aria-label="Przegląd zadań na dziś">
      <div className="tp-shell">
        <h1 className="tp-sr-heading">Przegląd zadań</h1>

        <div className="tp-counter" aria-label={`Zadanie ${idx + 1} z ${total}`}>
          {idx + 1}/{total}
        </div>

        <div
          ref={taskRef}
          className="tp-task-card"
          tabIndex={-1}
          role="group"
          aria-label={`Zadanie: ${task.name}`}
        >
          <div className="tp-task-name">{task.name}</div>
          <div className="tp-task-meta">
            {project && (
              <span className="tp-task-project">
                <span aria-hidden="true">▸ </span>{project.name}
              </span>
            )}
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

        <div className="proc-option-step proc-date-step" role="group" aria-label="Opcje daty">
          <div className="proc-step-hint">
            Wybierz klawiszem lub klikiem, potwierdź <kbd>↵</kbd>
          </div>
          <div className="proc-options-grid" role="radiogroup" aria-label="Wybierz datę">
            {dateOptions.map(opt => {
              if (opt.isCustom) {
                if (showParser) {
                  return (
                    <div key="parser" className="proc-date-parser">
                      <input
                        ref={parserRef}
                        type="text"
                        className="proc-parser-input"
                        placeholder="RRRR MM DD"
                        value={parserText}
                        onChange={e => setParserText(e.target.value)}
                        onKeyDown={e => {
                          e.stopPropagation();
                          if (e.key === 'Enter' && parsed) pickCustomDate(parsed);
                          if (e.key === 'Escape') { setShowParser(false); setParserText(''); }
                        }}
                      />
                      {parsed && <span className="proc-parser-preview">{formatPlannedDate(parsed, today)}</span>}
                    </div>
                  );
                }
                return (
                  <button
                    key={opt.key}
                    className={`proc-option-card${pendingKey === opt.key ? ' highlighted' : ''}`}
                    role="radio"
                    aria-checked={pendingKey === opt.key}
                    aria-keyshortcuts={opt.key}
                    onMouseEnter={() => setPendingKey(opt.key)}
                    onClick={() => { setShowParser(true); setParserText(''); }}
                  >
                    <span className="proc-option-label">{opt.label}</span>
                    <span className="proc-option-key" aria-hidden="true">{opt.key}</span>
                  </button>
                );
              }
              const hint = opt.date && !NO_HINT_LABELS.has(opt.label)
                ? formatPlannedDate(opt.date, today) : null;
              const isSelected = pendingKey === opt.key;
              return (
                <button
                  key={opt.key}
                  className={`proc-option-card${isSelected ? ' highlighted' : ''}${opt.isNext ? ' proc-option-next' : ''}`}
                  role="radio"
                  aria-checked={isSelected}
                  aria-keyshortcuts={opt.key}
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
                  <span className="proc-option-key" aria-hidden="true">{opt.key}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="tp-actions" role="group" aria-label="Akcje">
          <button className="tp-action-btn tp-done-btn" onClick={markDone} aria-keyshortcuts="d">
            Zakończ <kbd aria-hidden="true">d</kbd>
          </button>
          <button className="tp-action-btn tp-skip-btn" onClick={skip} aria-keyshortcuts="s">
            Pomiń <kbd aria-hidden="true">s</kbd>
          </button>
          {idx > 0 && (
            <button className="tp-action-btn tp-back-btn" onClick={goBack} aria-keyshortcuts="ArrowLeft">
              Cofnij <kbd aria-hidden="true">←</kbd>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
