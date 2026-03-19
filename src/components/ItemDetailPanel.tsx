import { useState, useEffect } from 'react';

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

  const commit = () => {
    const trimmed = localName.trim();
    if (trimmed && trimmed !== name) {
      onRename(trimmed);
    } else {
      setLocalName(name);
    }
  };

  return (
    <div className="task-detail-panel">
      <div className="detail-header">
        <span className="detail-title">{title}</span>
        <button className="close-btn" onClick={onClose}>✕</button>
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
