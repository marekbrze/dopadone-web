import { useState, useRef, useEffect } from 'react';
import type { Project } from '../types';

interface Props {
  projects: Project[];
  selectedProjectId: string | null;
  onChange: (id: string | null) => void;
}

export function EventProjectPicker({ projects, selectedProjectId, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const selectedProject = selectedProjectId ? projects.find(p => p.id === selectedProjectId) : null;
  const filtered = projects.filter(p => p.name.toLowerCase().includes(search.toLowerCase()));

  const select = (id: string | null) => {
    onChange(id);
    setOpen(false);
    setSearch('');
  };

  return (
    <div className="event-project-picker-wrap" ref={ref}>
      <button
        type="button"
        className="event-project-picker-btn"
        onClick={() => setOpen(v => !v)}
      >
        {selectedProject ? selectedProject.name : 'Inbox'}
        <span className="event-project-picker-chevron">▾</span>
      </button>
      {open && (
        <div className="event-project-picker-dropdown">
          <input
            className="event-project-search-input"
            placeholder="Szukaj projektu…"
            value={search}
            onChange={e => setSearch(e.target.value)}
            autoFocus
          />
          <div className="event-project-list">
            <button
              type="button"
              className={`event-project-option${selectedProjectId === null ? ' selected' : ''}`}
              onClick={() => select(null)}
            >
              Inbox
            </button>
            {filtered.map(p => (
              <button
                key={p.id}
                type="button"
                className={`event-project-option${selectedProjectId === p.id ? ' selected' : ''}`}
                onClick={() => select(p.id)}
              >
                {p.name}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
