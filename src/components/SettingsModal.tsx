import { useState } from 'react';
import type { Area, Lifter, Context } from '../types';

interface Props {
  areas: Area[];
  lifters: Lifter[];
  contexts: Context[];
  onDeleteArea: (id: string) => void;
  onDeleteLifter: (id: string) => void;
  onReorderAreas: (fromIndex: number, toIndex: number) => void;
  onAddContext: (name: string, icon: string) => void;
  onDeleteContext: (id: string) => void;
  onClose: () => void;
}

const EMOJI_OPTIONS = ['📞', '✉️', '💬', '🎨', '💻', '🏙️', '🛒', '📝', '🔧', '📱', '🤝', '📚', '🏠', '🚗', '💡', '⚡'];

export function SettingsModal({
  areas, lifters, contexts,
  onDeleteArea, onDeleteLifter, onReorderAreas,
  onAddContext, onDeleteContext, onClose,
}: Props) {
  const [activeCategory, setActiveCategory] = useState<'obszary' | 'konteksty'>('obszary');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [ctxName, setCtxName] = useState('');
  const [ctxIcon, setCtxIcon] = useState('📝');

  const handleDragStart = (index: number) => setDragIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };
  const handleDrop = (toIndex: number) => {
    if (dragIndex !== null && dragIndex !== toIndex) {
      onReorderAreas(dragIndex, toIndex);
    }
    setDragIndex(null);
    setDragOverIndex(null);
  };
  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleAddContext = (e: React.FormEvent) => {
    e.preventDefault();
    if (ctxName.trim()) {
      onAddContext(ctxName.trim(), ctxIcon);
      setCtxName('');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <div className="settings-sidebar">
          <div className="settings-sidebar-title">Ustawienia</div>
          <button
            className={`settings-nav-item ${activeCategory === 'obszary' ? 'active' : ''}`}
            onClick={() => setActiveCategory('obszary')}
          >
            Obszary
          </button>
          <button
            className={`settings-nav-item ${activeCategory === 'konteksty' ? 'active' : ''}`}
            onClick={() => setActiveCategory('konteksty')}
          >
            Konteksty
          </button>
        </div>

        <div className="settings-content">
          <div className="settings-content-header">
            <span>{activeCategory === 'obszary' ? 'Obszary i podobszary' : 'Konteksty'}</span>
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>
          <div className="settings-content-body">
            {activeCategory === 'obszary' && (
              <div>
                {areas.map((area, index) => {
                  const areaLifters = lifters.filter(l => l.areaId === area.id);
                  return (
                    <div
                      key={area.id}
                      className={`settings-area-block${dragOverIndex === index ? ' drag-over' : ''}`}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={e => handleDragOver(e, index)}
                      onDrop={() => handleDrop(index)}
                      onDragEnd={handleDragEnd}
                    >
                      <div className="settings-area-row">
                        <span className="drag-handle">⠿</span>
                        <span className="settings-area-swatch" style={{ background: area.color }} />
                        <span className="settings-area-name">{area.name}</span>
                        <button className="delete-btn" onClick={() => onDeleteArea(area.id)}>✕</button>
                      </div>
                      {areaLifters.map(lifter => (
                        <div key={lifter.id} className="settings-lifter-row">
                          <span className="settings-lifter-name">{lifter.name}</span>
                          <button className="delete-btn" onClick={() => onDeleteLifter(lifter.id)}>✕</button>
                        </div>
                      ))}
                    </div>
                  );
                })}
                {areas.length === 0 && <p className="empty-hint">Brak obszarów</p>}
              </div>
            )}

            {activeCategory === 'konteksty' && (
              <div>
                <div className="contexts-list">
                  {contexts.length === 0 && <p className="empty-hint">Brak kontekstów</p>}
                  {contexts.map(ctx => (
                    <div key={ctx.id} className="context-row">
                      <span className="context-icon">{ctx.icon}</span>
                      <span className="context-name">{ctx.name}</span>
                      <button className="delete-btn" onClick={() => onDeleteContext(ctx.id)}>✕</button>
                    </div>
                  ))}
                </div>
                <form className="context-add-form" onSubmit={handleAddContext}>
                  <div className="emoji-picker">
                    {EMOJI_OPTIONS.map(e => (
                      <button
                        key={e}
                        type="button"
                        className={`emoji-btn ${ctxIcon === e ? 'selected' : ''}`}
                        onClick={() => setCtxIcon(e)}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                  <div className="context-add-row">
                    <input
                      type="text"
                      placeholder="Nazwa kontekstu"
                      value={ctxName}
                      onChange={e => setCtxName(e.target.value)}
                    />
                    <button type="submit">Dodaj</button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
