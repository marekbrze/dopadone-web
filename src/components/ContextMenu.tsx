import { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface Props {
  x: number;
  y: number;
  onEdit: () => void;
  onArchive?: () => void;
  onDelete: () => void;
  onClose: () => void;
}

export function ContextMenu({ x, y, onEdit, onArchive, onDelete, onClose }: Props) {
  const menuHeight = onArchive ? 120 : 80;
  const top = y + menuHeight > window.innerHeight ? y - menuHeight : y;

  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      const target = e.target as Element;
      if (!target.closest('.context-menu')) onClose();
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', handleMouseDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  return createPortal(
    <div className="context-menu" style={{ left: x, top }}>
      <button className="context-menu-item" onClick={onEdit}>Edytuj</button>
      {onArchive && <button className="context-menu-item" onClick={onArchive}>Archiwizuj</button>}
      <button className="context-menu-item danger" onClick={onDelete}>Usuń</button>
    </div>,
    document.body
  );
}
