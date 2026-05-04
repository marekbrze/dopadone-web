import { useState, useMemo, useCallback } from 'react';
import type { DailyPracticeDay, Task, Project } from '../types';
import { db } from '../db';
import './DailyPracticeView.css';

interface Props {
  tasks: Task[];
  projects: Project[];
  dailyPractices: DailyPracticeDay[];
}

type HabitKey = 'inbox' | 'today' | 'projects';

const HABITS: { key: HabitKey; name: string }[] = [
  { key: 'inbox', name: 'Przetwórz inbox' },
  { key: 'today', name: 'Przetwórz dziś' },
  { key: 'projects', name: 'Przetwórz projekty' },
];

const DAY_LABELS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];

function toDateString(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function getHabitDone(day: DailyPracticeDay, key: HabitKey): boolean {
  if (key === 'inbox') return day.inboxDone;
  if (key === 'today') return day.todayDone;
  return day.projectsDone;
}

function getHabitTimestamp(day: DailyPracticeDay, key: HabitKey): string | null {
  if (key === 'inbox') return day.inboxCompletedAt;
  if (key === 'today') return day.todayCompletedAt;
  return day.projectsCompletedAt;
}

function setHabitDone(day: DailyPracticeDay, key: HabitKey, done: boolean): DailyPracticeDay {
  const now = done ? new Date().toISOString() : null;
  if (key === 'inbox') return { ...day, inboxDone: done, inboxCompletedAt: now };
  if (key === 'today') return { ...day, todayDone: done, todayCompletedAt: now };
  return { ...day, projectsDone: done, projectsCompletedAt: now };
}

function countDone(day: DailyPracticeDay): number {
  let n = 0;
  if (day.inboxDone) n++;
  if (day.todayDone) n++;
  if (day.projectsDone) n++;
  return n;
}

function getPolishDayOfWeek(date: Date): string {
  return date.toLocaleDateString('pl-PL', { weekday: 'long' });
}

function formatPolishDate(dateStr: string): string {
  const d = new Date(dateStr + 'T00:00:00');
  return d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
}

function formatTime(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' });
}

export function DailyPracticeView({ tasks, projects, dailyPractices }: Props) {
  const today = useMemo(() => toDateString(new Date()), []);
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  const practicesMap = useMemo(() => {
    const map = new Map<string, DailyPracticeDay>();
    for (const d of dailyPractices) map.set(d.date, d);
    return map;
  }, [dailyPractices]);

  const todayPractice = practicesMap.get(today) ?? {
    id: today,
    date: today,
    inboxDone: false,
    inboxCompletedAt: null,
    todayDone: false,
    todayCompletedAt: null,
    projectsDone: false,
    projectsCompletedAt: null,
  };

  const hasAnyTasks = tasks.length > 0;

  const autoDetected = useMemo(() => {
    if (!hasAnyTasks) return { inbox: false, today: false, projects: false };
    const inboxEmpty = tasks.filter(t => !t.done && t.projectId === null).length === 0;
    const todayDone = tasks.filter(t => !t.done && t.plannedDate && t.plannedDate <= today).length === 0;
    const activeProjects = projects.filter(p => !p.archived);
    const allProcessed = activeProjects.length > 0 && activeProjects.every(p => {
      const projectTasks = tasks.filter(t => t.projectId === p.id && !t.done);
      return projectTasks.length === 0 || projectTasks.every(t => t.duration != null && t.effort != null && t.contextId != null);
    });
    return { inbox: inboxEmpty, today: todayDone, projects: allProcessed };
  }, [tasks, projects, today, hasAnyTasks]);

  const weekDays = useMemo(() => {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
    const monday = new Date(now);
    monday.setDate(now.getDate() + mondayOffset);

    const days: { date: string; label: string; dayNum: number }[] = [];
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday);
      d.setDate(monday.getDate() + i);
      days.push({
        date: toDateString(d),
        label: DAY_LABELS[i],
        dayNum: d.getDate(),
      });
    }
    return days;
  }, []);

  const toggleHabit = useCallback(async (key: HabitKey) => {
    const current = practicesMap.get(today) ?? {
      id: today,
      date: today,
      inboxDone: false,
      inboxCompletedAt: null,
      todayDone: false,
      todayCompletedAt: null,
      projectsDone: false,
      projectsCompletedAt: null,
    };
    const currentDone = getHabitDone(current, key);
    const updated = setHabitDone(current, key, !currentDone);
    await db.dailyPractice.put(updated);
  }, [today, practicesMap]);

  const todayDate = new Date(today + 'T00:00:00');
  const hasHistory = dailyPractices.some(d => d.date !== today);
  const allDoneCount = countDone(todayPractice);
  const isAllDone = allDoneCount === 3;

  const viewedDay = selectedDay ?? today;
  const viewedPractice = viewedDay === today ? todayPractice : practicesMap.get(viewedDay);
  const isDetailOpen = selectedDay !== null && selectedDay !== today;

  return (
    <div className="dp" role="main" aria-label="Daily practice">
      <div className="dp-inner">
        <header className="dp-header">
          <div className="dp-label">Daily practice</div>
          <div className="dp-date">
            {todayDate.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long' })}
            <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 6 }}>
              {getPolishDayOfWeek(todayDate)}
            </span>
          </div>
        </header>

        <div className="dp-habits">
          {HABITS.map(({ key, name }) => {
            const done = getHabitDone(todayPractice, key);
            const auto = autoDetected[key];
            return (
              <button
                className={`dp-habit-card${done ? ' dp-habit-card--done' : ''}`}
                key={key}
                onClick={() => toggleHabit(key)}
                aria-pressed={done}
                aria-label={`${name}: ${done ? 'gotowe' : 'jeszcze nie'}${auto && !done ? ', wykryto automatycznie' : ''}`}
              >
                <span className="dp-habit-left">
                  <span className="dp-habit-name">{name}</span>
                  {auto && !done && <span className="dp-habit-auto">Wygląda na gotowe</span>}
                </span>
                <span className="dp-habit-status">{done ? 'Gotowe' : 'Jeszcze nie'}</span>
              </button>
            );
          })}
        </div>

        <div className="dp-section-divider" />

        <section className="dp-week" aria-label="Tydzień">
          <div className="dp-week-label">Ten tydzień</div>
          <div className="dp-week-grid" role="grid">
            {weekDays.map(({ date, label, dayNum }) => {
              const isFuture = date > today;
              const practice = practicesMap.get(date);
              const doneCount = practice ? countDone(practice) : 0;
              const isToday = date === today;
              const isSelected = date === selectedDay;

              let cellClass = 'dp-day-cell';
              if (isFuture) cellClass += ' dp-day-cell--future';
              else if (doneCount === 3) cellClass += ' dp-day-cell--full';
              else if (doneCount > 0) cellClass += ' dp-day-cell--partial';
              if (isToday) cellClass += ' dp-day-cell--today';
              if (isSelected && !isToday) cellClass += ' dp-day-cell--selected';

              return (
                <button
                  key={date}
                  className={cellClass}
                  onClick={() => {
                    if (!isFuture) setSelectedDay(prev => prev === date ? null : date);
                  }}
                  disabled={isFuture}
                  aria-label={`${formatPolishDate(date)}: ${doneCount}/3${isFuture ? ' (przyszłość)' : ''}`}
                >
                  <span className="dp-day-num">{dayNum}</span>
                  <span className="dp-day-label">{label}</span>
                </button>
              );
            })}
          </div>
          <div className="dp-legend">
            <span className="dp-legend-item"><span className="dp-legend-swatch dp-legend-swatch--full" /> 3/3</span>
            <span className="dp-legend-item"><span className="dp-legend-swatch dp-legend-swatch--partial" /> Częściowo</span>
            <span className="dp-legend-item"><span className="dp-legend-swatch dp-legend-swatch--empty" /> Brak</span>
          </div>
        </section>

        {isDetailOpen && viewedPractice && (
          <div className="dp-detail">
            <div className="dp-detail-header">
              <span className="dp-detail-date">{formatPolishDate(viewedDay)}</span>
              <button className="dp-detail-back" onClick={() => setSelectedDay(null)}>Dziś</button>
            </div>
            <div className="dp-detail-habits">
              {HABITS.map(({ key, name }) => {
                const done = getHabitDone(viewedPractice, key);
                const ts = getHabitTimestamp(viewedPractice, key);
                return (
                  <div key={key} className={`dp-detail-habit${done ? ' dp-detail-habit--done' : ''}`}>
                    <span className="dp-detail-habit-name">{name}</span>
                    <span className="dp-detail-habit-meta">{done ? `Gotowe${ts ? ' o ' + formatTime(ts) : ''}` : 'Nieukończone'}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {!hasHistory && !isAllDone && (
          <div className="dp-empty-state">
            <p>Zacznij codzienną praktykę. Przetwórz inbox, dzisiejsze zadania i projekty, by budować nawyk konsekwencji.</p>
          </div>
        )}
      </div>
    </div>
  );
}
