import { useEffect, useCallback } from 'react';

interface Props {
  title: string;
  message: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function ConfirmModal({ title, message, onConfirm, onCancel }: Props) {
  const handleKeydown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onCancel();
    if (e.key === 'Enter') onConfirm();
  }, [onConfirm, onCancel]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [handleKeydown]);

  return (
    <div className="modal-overlay" onClick={onCancel}>
      <div className="modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="modal-header">
          <span>{title}</span>
          <button className="modal-close" onClick={onCancel}>✕</button>
        </div>
        <div className="modal-body">
          <p style={{ margin: 0, lineHeight: 1.5 }}>{message}</p>
        </div>
        <div className="modal-actions">
          <button className="btn-primary" onClick={onConfirm}>Potwierdź</button>
          <button className="cancel" onClick={onCancel}>Anuluj</button>
        </div>
      </div>
    </div>
  );
}
