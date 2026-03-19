import { useState } from 'react';

interface Props {
  title: string;
  placeholder: string;
  onAdd: (name: string) => void;
  onClose: () => void;
}

export function AddItemModal({ title, placeholder, onAdd, onClose }: Props) {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (name.trim()) {
      onAdd(name.trim());
      onClose();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <h3>{title}</h3>
        <form onSubmit={handleSubmit}>
          <input
            autoFocus
            type="text"
            placeholder={placeholder}
            value={name}
            onChange={e => setName(e.target.value)}
          />
          <div className="modal-actions">
            <button type="submit">Dodaj</button>
            <button type="button" className="cancel" onClick={onClose}>Anuluj</button>
          </div>
        </form>
      </div>
    </div>
  );
}
