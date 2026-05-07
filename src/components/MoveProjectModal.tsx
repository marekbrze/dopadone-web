import { useState, useEffect, useCallback } from 'react';
import type { Area, Lifter } from '../types';

interface Props {
  projectAreaId: string;
  areas: Area[];
  lifters: Lifter[];
  onMove: (areaId: string, lifterId: string | null, newLifterName?: string) => void;
  onClose: () => void;
}

export function MoveProjectModal({ projectAreaId, areas, lifters, onMove, onClose }: Props) {
  const [selectedAreaId, setSelectedAreaId] = useState('');
  const [selectedLifterId, setSelectedLifterId] = useState('');
  const [newLifterName, setNewLifterName] = useState('');
  const [isCreatingLifter, setIsCreatingLifter] = useState(false);

  const filteredAreas = areas.filter(a => a.id !== projectAreaId && !a.isSystem);
  const filteredLifters = lifters.filter(l => l.areaId === selectedAreaId);

  useEffect(() => {
    setSelectedLifterId('');
    setNewLifterName('');
    setIsCreatingLifter(false);
  }, [selectedAreaId]);

  const handleKeydown = useCallback((e: KeyboardEvent) => {
    if (e.key === 'Escape') onClose();
  }, [onClose]);

  useEffect(() => {
    document.addEventListener('keydown', handleKeydown);
    return () => document.removeEventListener('keydown', handleKeydown);
  }, [handleKeydown]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedAreaId) return;

    if (isCreatingLifter) {
      const trimmed = newLifterName.trim();
      if (!trimmed) return;
      onMove(selectedAreaId, null, trimmed);
    } else {
      onMove(selectedAreaId, selectedLifterId || null);
    }
  };

  const canSubmit = selectedAreaId && (isCreatingLifter ? newLifterName.trim() : true);

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <h3>Przenieś do obszaru</h3>
        <form onSubmit={handleSubmit}>
          <div className="move-project-field">
            <label>Obszar docelowy</label>
            <select
              value={selectedAreaId}
              onChange={e => setSelectedAreaId(e.target.value)}
              autoFocus
            >
              <option value="">Wybierz obszar</option>
              {filteredAreas.map(a => (
                <option key={a.id} value={a.id}>{a.name}</option>
              ))}
            </select>
          </div>

          {selectedAreaId && (
            <div className="move-project-field">
              <label>Podobszar</label>
              {!isCreatingLifter ? (
                <div className="move-project-lifter-row">
                  <select
                    value={selectedLifterId}
                    onChange={e => setSelectedLifterId(e.target.value)}
                  >
                    <option value="">Wybierz podobszar</option>
                    {filteredLifters.map(l => (
                      <option key={l.id} value={l.id}>{l.name}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="move-project-new-btn"
                    onClick={() => setIsCreatingLifter(true)}
                  >+ Nowy</button>
                </div>
              ) : (
                <div className="move-project-lifter-row">
                  <input
                    type="text"
                    placeholder="Nazwa nowego podobszaru"
                    value={newLifterName}
                    onChange={e => setNewLifterName(e.target.value)}
                    autoFocus
                  />
                  <button
                    type="button"
                    className="move-project-new-btn"
                    onClick={() => { setIsCreatingLifter(false); setNewLifterName(''); }}
                  >Wybierz z listy</button>
                </div>
              )}
            </div>
          )}

          <div className="modal-actions">
            <button type="submit" disabled={!canSubmit}>Przenieś</button>
            <button type="button" className="cancel" onClick={onClose}>Anuluj</button>
          </div>
        </form>
      </div>
    </div>
  );
}
