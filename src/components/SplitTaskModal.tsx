import { useState, useRef, useEffect } from 'react';

interface Props {
  taskName: string;
  onConfirm: (names: string[]) => void;
  onClose: () => void;
}

export function SplitTaskModal({ taskName, onConfirm, onClose }: Props) {
  const [names, setNames] = useState<string[]>(['', '']);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const prevLengthRef = useRef(names.length);

  useEffect(() => {
    if (names.length > prevLengthRef.current) {
      inputRefs.current[names.length - 1]?.focus();
    }
    prevLengthRef.current = names.length;
  }, [names.length]);

  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  const addInput = () => {
    setNames(prev => [...prev, '']);
  };

  const removeName = (index: number) => {
    setNames(prev => prev.filter((_, i) => i !== index));
  };

  const updateName = (index: number, value: string) => {
    setNames(prev => prev.map((n, i) => i === index ? value : n));
  };

  const handleKeyDown = (e: React.KeyboardEvent, index: number) => {
    if (e.key === 'Enter' && index === names.length - 1) {
      e.preventDefault();
      addInput();
    }
  };

  const handleConfirm = () => {
    const filtered = names.map(n => n.trim()).filter(Boolean);
    if (filtered.length === 0) return;
    onConfirm(filtered);
  };

  const hasAnyName = names.some(n => n.trim());

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-header">
          <span>Rozbij zadanie</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>
        <div className="modal-body">
          <div className="form-group">
            <label>Oryginalne zadanie</label>
            <p style={{ margin: 0, fontStyle: 'italic', color: 'var(--text-muted)', fontSize: 13 }}>{taskName}</p>
          </div>
          <div className="form-group">
            <label>Nowe zadania</label>
            {names.map((name, i) => (
              <div key={i} style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 4 }}>
                <input
                  ref={el => { inputRefs.current[i] = el; }}
                  type="text"
                  value={name}
                  onChange={e => updateName(i, e.target.value)}
                  onKeyDown={e => handleKeyDown(e, i)}
                  placeholder={`Zadanie ${i + 1}`}
                  style={{ flex: 1 }}
                />
                <button
                  type="button"
                  className="modal-close"
                  onClick={() => removeName(i)}
                  disabled={names.length <= 1}
                  title="Usuń"
                  style={{ visibility: names.length <= 1 ? 'hidden' : undefined }}
                >
                  ✕
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addInput}
              style={{
                background: 'transparent',
                border: '1px dashed var(--border)',
                borderRadius: 'var(--radius)',
                color: 'var(--text-faint)',
                cursor: 'pointer',
                fontSize: 11,
                padding: '4px 10px',
                marginTop: 4,
              }}
            >
              + dodaj zadanie
            </button>
          </div>
        </div>
        <div className="modal-footer">
          <button className="cancel" onClick={onClose}>Anuluj</button>
          <button className="btn-primary" onClick={handleConfirm} disabled={!hasAnyName}>
            Rozbij
          </button>
        </div>
      </div>
    </div>
  );
}
