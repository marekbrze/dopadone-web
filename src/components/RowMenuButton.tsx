import { useState } from 'react';
import { ContextMenu } from './ContextMenu';

interface Props {
  onEdit?: () => void;
  onArchive?: () => void;
  onDelete?: () => void;
}

export function RowMenuButton({ onEdit, onArchive, onDelete }: Props) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ x: 0, y: 0 });

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    setPos({ x: rect.right - 120, y: rect.bottom + 2 });
    setOpen(true);
  };

  return (
    <>
      <button className="row-menu-btn" onClick={handleClick} title="Więcej opcji">⋯</button>
      {open && (
        <ContextMenu
          x={pos.x}
          y={pos.y}
          onEdit={() => { setOpen(false); onEdit?.(); }}
          onArchive={onArchive ? () => { setOpen(false); onArchive(); } : undefined}
          onDelete={() => { setOpen(false); onDelete?.(); }}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
