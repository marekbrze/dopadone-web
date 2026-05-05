import { useState, useRef, useEffect, useCallback } from 'react';
import React from 'react';
import type { Area, Project, Task } from '../types';

interface Props {
  areas: Area[];
  projects: Project[];
  tasks: Task[];
  todayStr: string;
  onUpdateTask: (id: string, updates: Partial<Task>) => Promise<void>;
  onClose: () => void;
}

type ProjectGroup = {
  projectId: string;
  projectName: string;
  tasks: Task[];
};

export function PlanujModal({ areas, projects, tasks, todayStr, onUpdateTask, onClose }: Props) {
  const nextTasks = tasks.filter(t => !t.done && t.isNext);

  const areasWithTasks = React.useMemo(() => {
    const areaIds = new Set<string>();
    for (const task of nextTasks) {
      const project = projects.find(p => p.id === task.projectId);
      if (project) areaIds.add(project.areaId);
    }
    return areas
      .filter(a => areaIds.has(a.id))
      .sort((a, b) => (a.order ?? 999) - (b.order ?? 999));
  }, [nextTasks, projects, areas]);

  const [activeAreaId, setActiveAreaId] = useState<string | null>(
    areasWithTasks.length > 0 ? areasWithTasks[0].id : null
  );

  const [planningIds, setPlanningIds] = useState<Set<string>>(new Set());

  const projectGroups = React.useMemo<ProjectGroup[]>(() => {
    if (!activeAreaId) return [];
    const areaTasks = nextTasks.filter(t => {
      const project = projects.find(p => p.id === t.projectId);
      return project?.areaId === activeAreaId;
    });
    const map = new Map<string, ProjectGroup>();
    for (const task of areaTasks) {
      const project = projects.find(p => p.id === task.projectId);
      const key = project?.id ?? '__no_project__';
      if (!map.has(key)) {
        map.set(key, {
          projectId: key,
          projectName: project?.name ?? 'Bez projektu',
          tasks: [],
        });
      }
      map.get(key)!.tasks.push(task);
    }
    return [...map.values()].sort((a, b) => a.projectName.localeCompare(b.projectName));
  }, [activeAreaId, nextTasks, projects]);

  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);
  const modalRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }
      if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
        const focusedEl = document.activeElement;
        const tabBtns = tabRefs.current.filter(Boolean) as HTMLButtonElement[];
        const idx = tabBtns.indexOf(focusedEl as HTMLButtonElement);
        if (idx === -1) return;
        e.preventDefault();
        const next = e.key === 'ArrowRight'
          ? (idx + 1) % tabBtns.length
          : (idx - 1 + tabBtns.length) % tabBtns.length;
        tabBtns[next]?.focus();
        setActiveAreaId(areasWithTasks[next]?.id ?? null);
      }
    };
    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [onClose, areasWithTasks]);

  useEffect(() => {
    const firstTab = tabRefs.current[0];
    if (firstTab) firstTab.focus();
  }, []);

  const handleToggleToday = useCallback(async (task: Task) => {
    const isPlanned = task.plannedDate === todayStr;
    setPlanningIds(prev => {
      const next = new Set(prev);
      if (isPlanned) next.delete(task.id);
      else next.add(task.id);
      return next;
    });

    try {
      if (isPlanned) {
        await onUpdateTask(task.id, { plannedDate: null, isNext: true });
      } else {
        await onUpdateTask(task.id, { plannedDate: todayStr, isNext: false });
      }
    } finally {
      setPlanningIds(prev => {
        const next = new Set(prev);
        next.delete(task.id);
        return next;
      });
    }
  }, [onUpdateTask, todayStr]);

  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  const activeArea = areas.find(a => a.id === activeAreaId);

  return (
    <div className="modal-overlay planuj-overlay" onClick={handleOverlayClick} ref={overlayRef}>
      <div className="modal planuj-modal" ref={modalRef} role="dialog" aria-modal="true" aria-label="Planuj dzień">
        <div className="modal-header">
          <h2>Planuj</h2>
          <button className="modal-close" onClick={onClose} aria-label="Zamknij">✕</button>
        </div>

        {areasWithTasks.length === 0 ? (
          <div className="planuj-empty">
            <p>Brak zadań następnych do zaplanowania.</p>
          </div>
        ) : (
          <>
            <div className="planuj-tabs" role="tablist" aria-label="Obszary">
              {areasWithTasks.map((area, i) => (
                <button
                  key={area.id}
                  ref={el => { tabRefs.current[i] = el; }}
                  role="tab"
                  aria-selected={area.id === activeAreaId}
                  className={`planuj-tab${area.id === activeAreaId ? ' active' : ''}`}
                  onClick={() => setActiveAreaId(area.id)}
                >
                  {area.name}
                </button>
              ))}
            </div>

            <div className="planuj-content" role="tabpanel" aria-label={activeArea?.name ?? 'Obszar'}>
              {projectGroups.length === 0 ? (
                <div className="planuj-empty">
                  <p>Brak zadań następnych w tym obszarze.</p>
                </div>
              ) : (
                projectGroups.map(group => (
                  <div key={group.projectId} className="planuj-project-group">
                    <div className="planuj-project-header">{group.projectName}</div>
                    {group.tasks.map(task => {
                      const isPlanned = task.plannedDate === todayStr;
                      const isPlanning = planningIds.has(task.id);
                      return (
                        <div
                          key={task.id}
                          className={`planuj-task${isPlanned ? ' planned' : ''}`}
                        >
                          <span className="planuj-task-name">{task.name}</span>
                          <button
                            className={`planuj-action-btn${isPlanned ? ' checked' : ''}`}
                            onClick={() => handleToggleToday(task)}
                            disabled={isPlanning}
                            aria-label={isPlanned ? 'Cofnij planowanie' : 'Zrób dziś'}
                          >
                            {isPlanned ? 'Dziś' : 'Zrób dziś'}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ))
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
