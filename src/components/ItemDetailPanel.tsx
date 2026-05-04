import { useState, useEffect, useCallback } from 'react';

interface Props {
  title: string;
  name: string;
  onRename: (newName: string) => void;
  onDelete: () => void;
  onClose: () => void;
}

export function ItemDetailPanel({ title, name, onRename, onDelete, onClose }: Props) {
  const [localName, setLocalName] = useState(name);

  useEffect(() => {
    setLocalName(name);
  }, [name]);

  const handleKeydown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') {
      onClose();
    }
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [handleKeydown]);

  const commit = () => {
    const trimmed = localName.trim();
    if (trimmed && trimmed !== name) {
      onRename(trimmed);
    } else {
      setLocalName(name);
    }
  };

  return (
    <div
      className="task-detail-panel item-detail-panel"
      role="dialog"
      aria-modal="true"
      aria-labelledby="item-detail-title"
    >
      <div className="detail-header">
        <span className="detail-title" id="item-detail-title">{title}</span>
        <button className="close-btn" onClick={onClose} aria-label="Zamknij">✕</button>
      </div>
      <div className="task-detail-body">
        <div className="detail-field">
          <label>Nazwa</label>
          <input
            className="detail-name-input"
            value={localName}
            onChange={e => setLocalName(e.target.value)}
            onBlur={commit}
            onKeyDown={e => {
              if (e.key === 'Enter') { commit(); (e.target as HTMLInputElement).blur(); }
              if (e.key === 'Escape') setLocalName(name);
            }}
            autoFocus
          />
        </div>
        <button className="delete-task-btn" onClick={onDelete}>Usuń {title.toLowerCase()}</button>
      </div>
    </div>
  );
}
