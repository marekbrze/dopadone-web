import { useState, useEffect, useRef } from 'react';
import React from 'react';
import type { Area, Project, Task, Context, WorkBlock } from '../types';

interface Props {
  areas: Area[];
  projects: Project[];
  tasks: Task[];
  contexts: Context[];
  workBlocks: WorkBlock[];
  onUpdateTask: (id: string, updates: Partial<Task>) => Promise<void>;
}

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function formatTime(minutes: number): string {
  const h = Math.floor(minutes / 60).toString().padStart(2, '0');
  const m = (minutes % 60).toString().padStart(2, '0');
  return `${h}:${m}`;
}

function getBlockColor(block: WorkBlock, areas: Area[]): string {
  if (block.color) return block.color;
  const area = areas.find(a => a.id === block.areaIds[0]);
  return area?.color ?? '#5c4a38';
}

function getMatchingTasks(block: WorkBlock, tasks: Task[], projects: Project[]): Task[] {
  if (block.blockType === 'manual') {
    return (block.taskIds ?? [])
      .map(id => tasks.find(t => t.id === id))
      .filter((t): t is Task => t !== undefined);
  }
  return tasks.filter(task => {
    if (task.done) return false;
    const project = projects.find(p => p.id === task.projectId);
    if (!project) return false;
    if (block.contextIds.length > 0 && !block.contextIds.includes(task.contextId ?? '')) return false;
    if (block.projectIds.length > 0) return block.projectIds.includes(task.projectId);
    if (block.lifterIds.length > 0 && (!project.lifterId || !block.lifterIds.includes(project.lifterId))) return false;
    if (block.areaIds.length > 0 && !block.areaIds.includes(project.areaId)) return false;
    return true;
  });
}

const priorityColors: Record<Task['priority'], string> = {
  low: '#5a7a5e',
  medium: '#a07830',
  high: '#a33a2a',
};

const hours = Array.from({ length: 24 }, (_, i) => i);

export function TodayView({ areas, projects, tasks, contexts: _contexts, workBlocks, onUpdateTask }: Props) {
  const [now, setNow] = useState(() => new Date());
  const [selectedBlockId, setSelectedBlockId] = useState<string | null>(null);
  const timelineRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1_000);
    return () => clearInterval(id);
  }, []);

  // Scroll timeline to current hour on mount
  useEffect(() => {
    if (timelineRef.current) {
      const nowMin = new Date().getHours() * 60 + new Date().getMinutes();
      timelineRef.current.scrollTop = Math.max(0, nowMin - 120);
    }
  }, []);

  const todayStr = toDateString(now);
  const todayBlocks = workBlocks
    .filter(b => b.date === todayStr)
    .sort((a, b) => a.startMinutes - b.startMinutes);

  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const currentBlock = todayBlocks.find(
    b => b.startMinutes <= nowMinutes && nowMinutes < b.endMinutes
  ) ?? null;

  useEffect(() => {
    if (selectedBlockId && !todayBlocks.find(b => b.id === selectedBlockId)) {
      setSelectedBlockId(null);
    }
  }, [workBlocks]);

  const displayBlock = selectedBlockId
    ? (todayBlocks.find(b => b.id === selectedBlockId) ?? currentBlock)
    : currentBlock;

  const blockTasks = displayBlock
    ? getMatchingTasks(displayBlock, tasks, projects)
    : [];

  const dateLabel = now.toLocaleDateString('pl-PL', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });

  const hh = String(now.getHours()).padStart(2, '0');
  const mm = String(now.getMinutes()).padStart(2, '0');
  const ss = String(now.getSeconds()).padStart(2, '0');

  const nextBlock = currentBlock === null
    ? todayBlocks.find(b => b.startMinutes > nowMinutes)
    : null;

  const handleBlockClick = (blockId: string) => {
    setSelectedBlockId(prev => prev === blockId ? null : blockId);
  };

  return (
    <div className="today-view">
      <div className="today-header">
        <div className="today-header-left">
          <div className="today-date-line">{dateLabel}</div>
          <div className="today-clock">
            <span className="today-clock-hm">{hh}:{mm}</span>
            <span className="today-clock-sep">:</span>
            <span className="today-clock-ss">{ss}</span>
          </div>
        </div>
        <div className="today-header-rule" />
      </div>

      <div className="today-body">
        {/* LEFT: day timeline */}
        <aside className="today-agenda">
          <div className="today-agenda-heading">Harmonogram dnia</div>
          <div className="today-timeline-wrap" ref={timelineRef}>
            <div className="today-timeline">
              {/* Time axis */}
              <div className="today-time-axis">
                {hours.map(h => (
                  <div
                    key={h}
                    className="agenda-hour-label"
                    style={{ top: `${h * 60}px` }}
                  >
                    {h.toString().padStart(2, '0')}:00
                  </div>
                ))}
              </div>

              {/* Day column */}
              <div className="today-day-col">
                {/* Hour lines */}
                {hours.map(h => (
                  <React.Fragment key={h}>
                    <div className="agenda-hour-line" style={{ top: `${h * 60}px` }} />
                    <div className="agenda-half-hour-line" style={{ top: `${h * 60 + 30}px` }} />
                  </React.Fragment>
                ))}

                {/* Current-time indicator */}
                <div className="agenda-now-line" style={{ top: `${nowMinutes}px` }} />

                {/* Work blocks */}
                {todayBlocks.map(block => {
                  const color = getBlockColor(block, areas);
                  const height = Math.max(block.endMinutes - block.startMinutes, 20);
                  const isSelected = block.id === (selectedBlockId ?? currentBlock?.id);
                  return (
                    <div
                      key={block.id}
                      className={`agenda-block${isSelected ? ' selected' : ''}`}
                      style={{
                        top: `${block.startMinutes}px`,
                        height: `${height}px`,
                        background: color + '33',
                        borderLeft: `3px solid ${color}`,
                      }}
                      onClick={() => handleBlockClick(block.id)}
                    >
                      <span className="agenda-block-title">{block.title}</span>
                      <span className="agenda-block-time">
                        {formatTime(block.startMinutes)}–{formatTime(block.endMinutes)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </aside>

        {/* RIGHT: active block panel */}
        <section className="today-active-panel">
          {displayBlock ? (
            <>
              <div
                className="today-active-header"
                style={{ borderTopColor: getBlockColor(displayBlock, areas) }}
              >
                <div className="today-active-meta">
                  <span className="today-active-time">
                    {formatTime(displayBlock.startMinutes)} – {formatTime(displayBlock.endMinutes)}
                  </span>
                  {displayBlock.id === currentBlock?.id && (
                    <span className="today-active-live-dot" />
                  )}
                </div>
                <div className="today-active-title">{displayBlock.title}</div>
              </div>
              <div className="today-active-tasks">
                {blockTasks.length === 0 ? (
                  <div className="today-active-empty">
                    Brak zadań przypisanych do tego bloku.
                  </div>
                ) : (
                  <>
                    <div className="today-tasks-section-label">
                      Zadania
                      <span className="today-tasks-count">
                        {blockTasks.filter(t => t.done).length}/{blockTasks.length}
                      </span>
                    </div>
                    {blockTasks.map(task => (
                      <div
                        key={task.id}
                        className={`today-task-item${task.done ? ' done' : ''}`}
                      >
                        <input
                          type="checkbox"
                          checked={task.done}
                          onChange={() => onUpdateTask(task.id, { done: !task.done })}
                          id={`today-task-${task.id}`}
                        />
                        <label
                          className="today-task-name"
                          htmlFor={`today-task-${task.id}`}
                        >
                          {task.name}
                        </label>
                        <span
                          className="today-priority-dot"
                          style={{ background: priorityColors[task.priority] }}
                          title={task.priority}
                        />
                      </div>
                    ))}
                  </>
                )}
              </div>
            </>
          ) : (
            <div className="today-active-empty-state">
              <div className="today-active-empty-icon">◎</div>
              <div className="today-active-empty-msg">
                {todayBlocks.length > 0
                  ? 'Żaden blok nie jest teraz aktywny.'
                  : 'Nie masz zaplanowanych bloków na dziś.'}
              </div>
              {nextBlock && (
                <div className="today-active-empty-sub">
                  Następny: <strong>{nextBlock.title}</strong> o {formatTime(nextBlock.startMinutes)}
                </div>
              )}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
