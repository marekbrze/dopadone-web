import { useState } from 'react';
import type { Context } from '../types';

interface Props {
  contexts: Context[];
  onAdd: (name: string, icon: string) => void;
  onDelete: (id: string) => void;
  onClose: () => void;
}

const EMOJI_OPTIONS = ['📞', '✉️', '💬', '🎨', '💻', '🏙️', '🛒', '📝', '🔧', '📱', '🤝', '📚', '🏠', '🚗', '💡', '⚡'];

export function ContextsPanel({ contexts, onAdd, onDelete, onClose }: Props) {
  const [name, setName] = useState('');
  const [icon, setIcon] = useState('📝');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onAdd(name.trim(), icon);
      setName('');
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal contexts-panel" onClick={e => e.stopPropagation()}>
        <div className="panel-header">
          <h3>Zarządzaj kontekstami</h3>
          <button className="close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="contexts-list">
          {contexts.length === 0 && (
            <p className="empty-hint">Brak kontekstów</p>
          )}
          {contexts.map(ctx => (
            <div key={ctx.id} className="context-row">
              <span className="context-icon">{ctx.icon}</span>
              <span className="context-name">{ctx.name}</span>
              <button className="delete-btn" onClick={() => onDelete(ctx.id)}>✕</button>
            </div>
          ))}
        </div>

        <form className="context-add-form" onSubmit={handleAdd}>
          <div className="emoji-picker">
            {EMOJI_OPTIONS.map(e => (
              <button
                key={e}
                type="button"
                className={`emoji-btn ${icon === e ? 'selected' : ''}`}
                onClick={() => setIcon(e)}
              >
                {e}
              </button>
            ))}
          </div>
          <div className="context-add-row">
            <input
              type="text"
              placeholder="Nazwa kontekstu"
              value={name}
              onChange={e => setName(e.target.value)}
            />
            <button type="submit">Dodaj</button>
          </div>
        </form>
      </div>
    </div>
  );
}
