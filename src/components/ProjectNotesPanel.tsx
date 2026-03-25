import { useState, useRef, useEffect, useCallback } from 'react';
import type { ProjectNote } from '../types';
import './ProjectNotesPanel.css';

interface Props {
  projectId: string;
  notes: ProjectNote[];
  onCreate: (data: { title?: string; content: string }) => Promise<void>;
  onUpdate: (id: string, data: Partial<ProjectNote>) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
}

// ── Simple markdown renderer ──────────────────────────────────────────────────

function renderMarkdown(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const nodes: React.ReactNode[] = [];
  let i = 0;
  let key = 0;

  function inlineFormat(line: string): React.ReactNode {
    // Split on bold (**text**), italic (*text*), inline code (`text`)
    const parts: React.ReactNode[] = [];
    const regex = /(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    while ((m = regex.exec(line)) !== null) {
      if (m.index > last) parts.push(line.slice(last, m.index));
      const token = m[0];
      if (token.startsWith('`')) {
        parts.push(<code key={key++} className="md-code">{token.slice(1, -1)}</code>);
      } else if (token.startsWith('**')) {
        parts.push(<strong key={key++}>{token.slice(2, -2)}</strong>);
      } else {
        parts.push(<em key={key++}>{token.slice(1, -1)}</em>);
      }
      last = m.index + token.length;
    }
    if (last < line.length) parts.push(line.slice(last));
    return parts.length === 1 && typeof parts[0] === 'string' ? parts[0] : <>{parts}</>;
  }

  while (i < lines.length) {
    const line = lines[i];

    // Heading
    if (line.startsWith('### ')) {
      nodes.push(<h3 key={key++} className="md-h3">{inlineFormat(line.slice(4))}</h3>);
      i++; continue;
    }
    if (line.startsWith('## ')) {
      nodes.push(<h2 key={key++} className="md-h2">{inlineFormat(line.slice(3))}</h2>);
      i++; continue;
    }
    if (line.startsWith('# ')) {
      nodes.push(<h1 key={key++} className="md-h1">{inlineFormat(line.slice(2))}</h1>);
      i++; continue;
    }

    // Blockquote
    if (line.startsWith('> ')) {
      nodes.push(<blockquote key={key++} className="md-blockquote">{inlineFormat(line.slice(2))}</blockquote>);
      i++; continue;
    }

    // Unordered list — collect consecutive items
    if (line.match(/^[-*] /)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && lines[i].match(/^[-*] /)) {
        items.push(<li key={key++}>{inlineFormat(lines[i].slice(2))}</li>);
        i++;
      }
      nodes.push(<ul key={key++} className="md-ul">{items}</ul>);
      continue;
    }

    // Ordered list
    if (line.match(/^\d+\. /)) {
      const items: React.ReactNode[] = [];
      while (i < lines.length && lines[i].match(/^\d+\. /)) {
        items.push(<li key={key++}>{inlineFormat(lines[i].replace(/^\d+\. /, ''))}</li>);
        i++;
      }
      nodes.push(<ol key={key++} className="md-ol">{items}</ol>);
      continue;
    }

    // Blank line — skip (paragraph spacing handled by CSS on <p>)
    if (line.trim() === '') {
      i++; continue;
    }

    // Paragraph — collect until blank line or block element
    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].match(/^#{1,3} /) &&
      !lines[i].startsWith('> ') &&
      !lines[i].match(/^[-*] /) &&
      !lines[i].match(/^\d+\. /)
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      const content = paraLines.map((l, idx) => (
        idx < paraLines.length - 1
          ? <>{inlineFormat(l)}<br /></>
          : inlineFormat(l)
      ));
      nodes.push(<p key={key++} className="md-p">{content}</p>);
    }
  }

  return nodes;
}

// ─────────────────────────────────────────────────────────────────────────────

export function ProjectNotesPanel({ notes, onCreate, onUpdate, onDelete }: Props) {
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [activeNoteId, setActiveNoteId] = useState<string | null>(notes[0]?.id ?? null);
  const [composerContent, setComposerContent] = useState('');
  const [composerTitle, setComposerTitle] = useState('');
  const [composerFocused, setComposerFocused] = useState(false);

  const feedRef = useRef<HTMLDivElement>(null);
  const noteRefs = useRef<Map<string, HTMLDivElement>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Set first note as active when notes change and none active
  useEffect(() => {
    if (!activeNoteId && notes.length > 0) setActiveNoteId(notes[0].id);
  }, [notes, activeNoteId]);

  // Scroll spy via IntersectionObserver
  const setupObserver = useCallback(() => {
    observerRef.current?.disconnect();
    if (!feedRef.current) return;

    const candidates: { id: string; ratio: number }[] = [];

    observerRef.current = new IntersectionObserver(
      (entries) => {
        entries.forEach(entry => {
          const id = (entry.target as HTMLDivElement).dataset.noteId!;
          const existing = candidates.findIndex(c => c.id === id);
          if (existing >= 0) candidates[existing].ratio = entry.intersectionRatio;
          else candidates.push({ id, ratio: entry.intersectionRatio });
        });
        const best = candidates.reduce((a, b) => a.ratio >= b.ratio ? a : b, { id: '', ratio: -1 });
        if (best.ratio > 0) setActiveNoteId(best.id);
      },
      { root: feedRef.current, threshold: [0, 0.25, 0.5, 0.75, 1] }
    );

    noteRefs.current.forEach((el) => observerRef.current!.observe(el));
  }, []);

  useEffect(() => {
    setupObserver();
    return () => observerRef.current?.disconnect();
  }, [notes, setupObserver]);

  const scrollToNote = (id: string) => {
    noteRefs.current.get(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveNoteId(id);
  };

  const startEdit = (note: ProjectNote) => {
    setEditingNoteId(note.id);
    setEditContent(note.content);
    setEditTitle(note.title ?? '');
  };

  const cancelEdit = () => {
    setEditingNoteId(null);
    setEditContent('');
    setEditTitle('');
  };

  const saveEdit = async (id: string) => {
    await onUpdate(id, {
      content: editContent,
      title: editTitle.trim() || null,
      updatedAt: new Date().toISOString(),
    });
    setEditingNoteId(null);
  };

  const submitComposer = async () => {
    const content = composerContent.trim();
    if (!content) return;
    await onCreate({ title: composerTitle.trim() || undefined, content });
    setComposerContent('');
    setComposerTitle('');
  };

  const handleComposerKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      submitComposer();
    }
  };

  const sortedNotes = [...notes].sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const getPreview = (note: ProjectNote) => {
    const text = note.content.replace(/[#*`>_]/g, '').trim();
    return text.length > 80 ? text.slice(0, 80) + '…' : text;
  };

  return (
    <div className="notes-panel">
      {/* Left: scroll-spy list */}
      <div className="notes-list">
        <div className="notes-list-header">
          <span>Notatki</span>
          <span className="notes-count">{notes.length}</span>
        </div>
        <div className="notes-list-items">
          {sortedNotes.length === 0 && (
            <p className="notes-list-empty">Brak notatek</p>
          )}
          {sortedNotes.map(note => (
            <button
              key={note.id}
              className={`notes-list-item ${note.id === activeNoteId ? 'active' : ''}`}
              onClick={() => scrollToNote(note.id)}
            >
              {note.title && <span className="notes-list-item-title">{note.title}</span>}
              <span className="notes-list-item-preview">{getPreview(note)}</span>
            </button>
          ))}
        </div>
      </div>

      {/* Right: feed + composer */}
      <div className="notes-feed-wrap">
        <div className="notes-feed" ref={feedRef}>
          {sortedNotes.length === 0 && (
            <p className="notes-feed-empty">Dodaj pierwszą notatkę poniżej</p>
          )}
          {sortedNotes.map(note => (
            <div
              key={note.id}
              className="note-card"
              data-note-id={note.id}
              ref={el => {
                if (el) noteRefs.current.set(note.id, el);
                else noteRefs.current.delete(note.id);
              }}
            >
              <div className="note-card-actions">
                {editingNoteId !== note.id && (
                  <>
                    <button className="note-action-btn" onClick={() => startEdit(note)} title="Edytuj">✏️</button>
                    <button className="note-action-btn note-delete-btn" onClick={() => onDelete(note.id)} title="Usuń">🗑</button>
                  </>
                )}
              </div>
              {(editingNoteId === note.id || note.title) && (
                <div className="note-card-header">
                  {editingNoteId === note.id ? (
                    <input
                      className="note-edit-title"
                      placeholder="Tytuł (opcjonalny)"
                      value={editTitle}
                      onChange={e => setEditTitle(e.target.value)}
                    />
                  ) : (
                    <span className="note-title">{note.title}</span>
                  )}
                </div>
              )}

              {editingNoteId === note.id ? (
                <div className="note-edit-body">
                  <textarea
                    className="note-edit-textarea"
                    value={editContent}
                    onChange={e => setEditContent(e.target.value)}
                    autoFocus
                  />
                  <div className="note-edit-actions">
                    <button className="note-save-btn" onClick={() => saveEdit(note.id)}>Zapisz</button>
                    <button className="note-cancel-btn" onClick={cancelEdit}>Anuluj</button>
                  </div>
                </div>
              ) : (
                <div
                  className="note-content"
                  onClick={() => startEdit(note)}
                  title="Kliknij, aby edytować"
                >
                  {renderMarkdown(note.content)}
                </div>
              )}

              <div className="note-meta">
                {new Date(note.updatedAt).toLocaleDateString('pl-PL', {
                  day: 'numeric', month: 'short', year: 'numeric',
                  hour: '2-digit', minute: '2-digit',
                })}
              </div>
            </div>
          ))}
        </div>

        {/* Composer */}
        <div className={`notes-composer${composerFocused ? ' focused' : ''}`}>
          <div className="notes-composer-card">
            <input
              className="composer-title-input"
              placeholder="Tytuł (opcjonalny)"
              value={composerTitle}
              onChange={e => setComposerTitle(e.target.value)}
              onFocus={() => setComposerFocused(true)}
              onBlur={() => setComposerFocused(false)}
            />
            <div className="composer-divider" />
            <textarea
              className="composer-textarea"
              placeholder="Napisz notatkę…"
              value={composerContent}
              onChange={e => {
                setComposerContent(e.target.value);
                e.target.style.height = 'auto';
                e.target.style.height = e.target.scrollHeight + 'px';
              }}
              onKeyDown={handleComposerKeyDown}
              onFocus={() => setComposerFocused(true)}
              onBlur={() => setComposerFocused(false)}
              rows={2}
            />
            <div className="composer-footer">
              <span className="composer-hint">Enter ↵ wyślij · Shift+Enter nowa linia</span>
              <button
                className="composer-send-btn"
                onClick={submitComposer}
                disabled={!composerContent.trim()}
              >Dodaj →</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
