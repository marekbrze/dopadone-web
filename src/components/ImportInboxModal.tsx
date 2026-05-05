import { useState, useRef, useEffect } from 'react';

interface Props {
  onImport: (names: string[]) => void;
  onClose: () => void;
}

const CLEANUP_RE = /^[\s]*[-—–•*·▪▸►→]+\s*|^[\s]*[0-9]+[.)]\s*|^[\s]*[a-zA-Z][.)]\s*|^[\s]*[IVXLCDMivxlcdm]+[.)]\s*/;

function parseLines(raw: string): string[] {
  return raw
    .split('\n')
    .map(line => line.replace(CLEANUP_RE, '').trim())
    .filter(line => line.length > 0);
}

function taskLabel(count: number): string {
  if (count === 1) return '1 zadanie';
  if (count < 5) return `${count} zadania`;
  return `${count} zadań`;
}

export function ImportInboxModal({ onImport, onClose }: Props) {
  const [step, setStep] = useState<'paste' | 'preview'>('paste');
  const [raw, setRaw] = useState('');
  const [checked, setChecked] = useState<boolean[]>([]);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const confirmBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (step === 'paste') textareaRef.current?.focus();
    if (step === 'preview') confirmBtnRef.current?.focus();
  }, [step]);

  const parsed = parseLines(raw);

  const handlePreview = () => {
    if (parsed.length === 0) return;
    setChecked(parsed.map(() => true));
    setStep('preview');
  };

  const toggle = (idx: number) => {
    setChecked(prev => prev.map((v, i) => i === idx ? !v : v));
  };

  const selected = checked.filter(Boolean).length;

  const handleConfirm = () => {
    const names = parsed.filter((_, i) => checked[i]);
    if (names.length === 0) return;
    onImport(names);
    onClose();
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      if (step === 'preview') setStep('paste');
      else onClose();
    }
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
      e.preventDefault();
      if (step === 'paste') handlePreview();
      else handleConfirm();
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="import-inbox-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Importuj zadania do Inbox"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="modal-header">
          <h2>Importuj do Inbox</h2>
          <button className="modal-close" onClick={onClose} aria-label="Zamknij">✕</button>
        </div>

        {step === 'paste' ? (
          <>
            <div className="modal-body">
              <textarea
                ref={textareaRef}
                className="import-inbox-textarea"
                placeholder="Wklej listę zadań..."
                value={raw}
                onChange={e => setRaw(e.target.value)}
                rows={8}
              />
            </div>
            <div className="modal-footer">
              <button className="modal-actions-cancel" onClick={onClose}>Anuluj</button>
              <button
                className="modal-actions-primary"
                disabled={parsed.length === 0}
                onClick={handlePreview}
              >
                Podgląd
              </button>
            </div>
          </>
        ) : (
          <>
            <div className="modal-body">
              <span className="import-inbox-count">{taskLabel(selected)} do dodania</span>
              <div className="import-inbox-preview">
                {parsed.map((name, i) => (
                  <label key={i} className="import-inbox-item">
                    <input
                      type="checkbox"
                      checked={checked[i]}
                      onChange={() => toggle(i)}
                    />
                    <span>{name}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="modal-actions-cancel" onClick={() => setStep('paste')}>Wstecz</button>
              <button
                ref={confirmBtnRef}
                className="modal-actions-primary"
                disabled={selected === 0}
                onClick={handleConfirm}
              >
                Dodaj {taskLabel(selected)}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
