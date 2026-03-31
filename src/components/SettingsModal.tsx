import { useState, useEffect, useRef } from 'react';
import type { Area, Effort, Lifter, Context, Project, ExportData, ImportPreview, ImportMode, BlockTemplate } from '../types';

const ENERGY_LEVELS: { value: Effort; label: string; color: string }[] = [
  { value: 'low',    label: 'Niski',   color: '#5a7a5e' },
  { value: 'medium', label: 'Średni',  color: '#a07830' },
  { value: 'high',   label: 'Wysoki',  color: '#a33a2a' },
];
import { db, isCloudSchema } from '../db';
import { migrateToCloudSchema, connectToExistingCloud } from '../utils/cloudMigration';
import {
  exportAllData,
  parseImportFile,
  previewImport,
  executeImport,
  loadAutoBackup,
  clearAutoBackup,
  downloadBlob,
  formatExportDate,
  isEncryptedFile,
} from '../utils/dataPortability';

interface Props {
  areas: Area[];
  lifters: Lifter[];
  contexts: Context[];
  projects: Project[];
  blockTemplates?: BlockTemplate[];
  onDeleteArea: (id: string) => void;
  onDeleteLifter: (id: string) => void;
  onReorderAreas: (fromIndex: number, toIndex: number) => void;
  onAddContext: (name: string, icon: string) => void;
  onDeleteContext: (id: string) => void;
  onRestoreProject: (id: string) => void;
  onAddBlockTemplate?: (t: Omit<BlockTemplate, 'id'>) => void;
  onDeleteBlockTemplate?: (id: string) => void;
  onClose: () => void;
}

const EMOJI_OPTIONS = ['📞', '✉️', '💬', '🎨', '💻', '🏙️', '🛒', '📝', '🔧', '📱', '🤝', '📚', '🏠', '🚗', '💡', '⚡'];

export function SettingsModal({
  areas, lifters, contexts, projects,
  blockTemplates = [],
  onDeleteArea, onDeleteLifter, onReorderAreas,
  onAddContext, onDeleteContext, onRestoreProject,
  onAddBlockTemplate, onDeleteBlockTemplate,
  onClose,
}: Props) {
  const [activeCategory, setActiveCategory] = useState<'obszary' | 'konteksty' | 'projekty' | 'backup' | 'sync' | 'szablony'>('obszary');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [ctxName, setCtxName] = useState('');
  const [ctxIcon, setCtxIcon] = useState('📝');
  const [exportPassword, setExportPassword] = useState('');
  const [exporting, setExporting] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPassword, setImportPassword] = useState('');
  const [importEncrypted, setImportEncrypted] = useState(false);
  const [importData, setImportData] = useState<ExportData | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [importMode, setImportMode] = useState<ImportMode>('merge');
  const [importing, setImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [autoBackup, setAutoBackup] = useState<ExportData | null>(null);
  // Block template form state
  const [showTemplateForm, setShowTemplateForm] = useState(false);
  const [tplName, setTplName] = useState('');
  const [tplAreaIds, setTplAreaIds] = useState<string[]>([]);
  const [tplLifterIds, setTplLifterIds] = useState<string[]>([]);
  const [tplProjectIds, setTplProjectIds] = useState<string[]>([]);
  const [tplContextIds, setTplContextIds] = useState<string[]>([]);
  const [tplEffortLevels, setTplEffortLevels] = useState<Effort[]>([]);

  function toggleTplArr<T>(arr: T[], val: T): T[] {
    return arr.includes(val) ? arr.filter(x => x !== val) : [...arr, val];
  }

  const tplFilteredLifters = tplAreaIds.length > 0 ? lifters.filter(l => tplAreaIds.includes(l.areaId)) : lifters;
  const tplFilteredProjects = projects.filter(p => {
    if (tplAreaIds.length > 0 && !tplAreaIds.includes(p.areaId)) return false;
    if (tplLifterIds.length > 0 && p.lifterId && !tplLifterIds.includes(p.lifterId)) return false;
    return !p.archived;
  });

  const handleSaveTemplate = (e: React.FormEvent) => {
    e.preventDefault();
    if (!tplName.trim() || !onAddBlockTemplate) return;
    onAddBlockTemplate({ name: tplName.trim(), areaIds: tplAreaIds, lifterIds: tplLifterIds, projectIds: tplProjectIds, contextIds: tplContextIds, effortLevels: tplEffortLevels });
    setTplName(''); setTplAreaIds([]); setTplLifterIds([]); setTplProjectIds([]); setTplContextIds([]); setTplEffortLevels([]);
    setShowTemplateForm(false);
  };

  const [cloudUrl, setCloudUrl] = useState(() => localStorage.getItem('dopadone-cloud-url') ?? '');
  const [urlDraft, setUrlDraft] = useState(() => localStorage.getItem('dopadone-cloud-url') ?? '');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [syncEmail, setSyncEmail] = useState('');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'sending' | 'awaiting-otp' | 'verifying'>('idle');
  const [syncOtp, setSyncOtp] = useState('');
  const [currentUser, setCurrentUser] = useState<{ userId?: string; email?: string; isLoggedIn: boolean } | null>(null);
  const [migrating, setMigrating] = useState(false);

  useEffect(() => {
    setAutoBackup(loadAutoBackup());
  }, []);

  useEffect(() => {
    if (!cloudUrl) return;
    try {
      const subscription = db.cloud.currentUser.subscribe((user) => {
        setCurrentUser(user ? { userId: user.userId, email: user.email, isLoggedIn: user.isLoggedIn ?? false } : { isLoggedIn: false });
      });
      return () => subscription.unsubscribe();
    } catch {
      // cloud not configured
    }
  }, [cloudUrl]);

  const validateDexieCloudUrl = (url: string): string | null => {
    if (!url) return null;
    try {
      const parsed = new URL(url);
      if (!parsed.hostname.endsWith('.dexie.cloud')) return 'URL musi wskazywać na domenę *.dexie.cloud';
      return null;
    } catch {
      return 'Nieprawidłowy URL';
    }
  };

  const handleSaveUrl = () => {
    const err = validateDexieCloudUrl(urlDraft);
    if (err) { setUrlError(err); return; }
    setUrlError(null);
    if (urlDraft) {
      localStorage.setItem('dopadone-cloud-url', urlDraft);
    } else {
      localStorage.removeItem('dopadone-cloud-url');
    }
    setCloudUrl(urlDraft);
    window.location.reload();
  };

  const handleLogin = async () => {
    if (!syncEmail.trim()) return;
    setSyncStatus('sending');
    try {
      await db.cloud.login({ email: syncEmail.trim(), grant_type: 'otp' });
      setSyncStatus('awaiting-otp');
    } catch {
      setSyncStatus('idle');
    }
  };

  const handleVerifyOtp = async () => {
    if (!syncOtp.trim()) return;
    setSyncStatus('verifying');
    try {
      await db.cloud.login({ email: syncEmail.trim(), grant_type: 'otp', otp: syncOtp.trim() });
      setSyncStatus('idle');
      setSyncOtp('');
    } catch {
      setSyncStatus('awaiting-otp');
    }
  };

  const handleLogout = async () => {
    try {
      await db.cloud.logout();
      setCurrentUser(null);
    } catch {
      // ignore
    }
  };

  const handleDragStart = (index: number) => setDragIndex(index);
  const handleDragOver = (e: React.DragEvent, index: number) => {
    e.preventDefault();
    setDragOverIndex(index);
  };
  const handleDrop = (toIndex: number) => {
    if (dragIndex !== null && dragIndex !== toIndex) {
      onReorderAreas(dragIndex, toIndex);
    }
    setDragIndex(null);
    setDragOverIndex(null);
  };
  const handleDragEnd = () => {
    setDragIndex(null);
    setDragOverIndex(null);
  };

  const handleAddContext = (e: React.FormEvent) => {
    e.preventDefault();
    if (ctxName.trim()) {
      onAddContext(ctxName.trim(), ctxIcon);
      setCtxName('');
    }
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const blob = await exportAllData(db, exportPassword || undefined);
      const date = new Date().toISOString().split('T')[0];
      downloadBlob(blob, `dopadone-backup-${date}.json`);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  };

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const content = await file.text();
    const encrypted = isEncryptedFile(content);

    setImportFile(file);
    setImportEncrypted(encrypted);
    setImportData(null);
    setImportPreview(null);
    setImportError(null);
    setImportPassword('');

    if (!encrypted) {
      await parseImportFileSafe(file, undefined);
    }
  };

  const parseImportFileSafe = async (file: File, password?: string) => {
    try {
      const data = await parseImportFile(file, password);
      setImportData(data);
      setImportError(null);
      const preview = await previewImport(db, data);
      setImportPreview(preview);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Błąd parsowania pliku');
      setImportData(null);
      setImportPreview(null);
    }
  };

  const handleDecryptImport = async () => {
    if (!importFile) return;
    await parseImportFileSafe(importFile, importPassword || undefined);
  };

  const handleExecuteImport = async () => {
    if (!importData) return;
    setImporting(true);
    try {
      await executeImport(db, importData, importMode);
      window.location.reload();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Błąd importu');
    } finally {
      setImporting(false);
    }
  };

  const handleRestoreAutoBackup = async () => {
    if (!autoBackup) return;
    setImportData(autoBackup);
    setImportMode('replace');
    const preview = await previewImport(db, autoBackup);
    setImportPreview(preview);
  };

  const handleClearAutoBackup = () => {
    clearAutoBackup();
    setAutoBackup(null);
  };

  const resetImport = () => {
    setImportFile(null);
    setImportData(null);
    setImportPreview(null);
    setImportPassword('');
    setImportEncrypted(false);
    setImportError(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={e => e.stopPropagation()}>
        <div className="settings-mobile-nav">
          <select
            className="settings-mobile-select"
            value={activeCategory}
            onChange={e => setActiveCategory(e.target.value as typeof activeCategory)}
          >
            <option value="obszary">Obszary</option>
            <option value="konteksty">Konteksty</option>
            <option value="projekty">Projekty</option>
            <option value="szablony">Szablony bloków</option>
            <option value="backup">Kopia zapasowa</option>
            <option value="sync">Synchronizacja</option>
          </select>
          <button className="settings-mobile-close-btn" onClick={onClose}>✕</button>
        </div>

        <div className="settings-sidebar">
          <div className="settings-sidebar-title">Ustawienia</div>
          <button
            className={`settings-nav-item ${activeCategory === 'obszary' ? 'active' : ''}`}
            onClick={() => setActiveCategory('obszary')}
          >
            Obszary
          </button>
          <button
            className={`settings-nav-item ${activeCategory === 'konteksty' ? 'active' : ''}`}
            onClick={() => setActiveCategory('konteksty')}
          >
            Konteksty
          </button>
          <button
            className={`settings-nav-item ${activeCategory === 'projekty' ? 'active' : ''}`}
            onClick={() => setActiveCategory('projekty')}
          >
            Projekty
          </button>
          <button
            className={`settings-nav-item ${activeCategory === 'szablony' ? 'active' : ''}`}
            onClick={() => setActiveCategory('szablony')}
          >
            Szablony bloków
          </button>
          <button
            className={`settings-nav-item ${activeCategory === 'backup' ? 'active' : ''}`}
            onClick={() => setActiveCategory('backup')}
          >
            Kopia zapasowa
          </button>
          <button
            className={`settings-nav-item ${activeCategory === 'sync' ? 'active' : ''}`}
            onClick={() => setActiveCategory('sync')}
          >
            Synchronizacja
          </button>
        </div>

        <div className="settings-content">
          <div className="settings-content-header">
            <span>
              {activeCategory === 'obszary' ? 'Obszary i podobszary'
                : activeCategory === 'konteksty' ? 'Konteksty'
                : activeCategory === 'projekty' ? 'Zarchiwizowane projekty'
                : activeCategory === 'szablony' ? 'Szablony bloków'
                : activeCategory === 'backup' ? 'Kopia zapasowa'
                : 'Synchronizacja'}
            </span>
            <button className="close-btn" onClick={onClose}>✕</button>
          </div>
          <div className="settings-content-body">
            {activeCategory === 'obszary' && (
              <div>
                {areas.map((area, index) => {
                  const areaLifters = lifters.filter(l => l.areaId === area.id);
                  return (
                    <div
                      key={area.id}
                      className={`settings-area-block${dragOverIndex === index ? ' drag-over' : ''}`}
                      draggable
                      onDragStart={() => handleDragStart(index)}
                      onDragOver={e => handleDragOver(e, index)}
                      onDrop={() => handleDrop(index)}
                      onDragEnd={handleDragEnd}
                    >
                      <div className="settings-area-row">
                        <span className="drag-handle">⠿</span>
                        <span className="settings-area-swatch" style={{ background: area.color }} />
                        <span className="settings-area-name">{area.name}</span>
                        <button className="delete-btn" onClick={() => onDeleteArea(area.id)}>✕</button>
                      </div>
                      {areaLifters.map(lifter => (
                        <div key={lifter.id} className="settings-lifter-row">
                          <span className="settings-lifter-name">{lifter.name}</span>
                          <button className="delete-btn" onClick={() => onDeleteLifter(lifter.id)}>✕</button>
                        </div>
                      ))}
                    </div>
                  );
                })}
                {areas.length === 0 && <p className="empty-hint">Brak obszarów</p>}
                <div style={{ marginTop: 24, paddingTop: 16, borderTop: '1px solid var(--border-light)' }}>
                  <p style={{ fontSize: 11, color: 'var(--text-faint)', marginBottom: 10, textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                    Konfiguracja
                  </p>
                  <button
                    className="cancel"
                    style={{ fontSize: 12, padding: '6px 12px', border: '1px solid var(--border)', borderRadius: 'var(--radius)', cursor: 'pointer', background: 'transparent', color: 'var(--text-muted)', fontFamily: 'inherit' }}
                    onClick={() => {
                      if (!window.confirm('Spowoduje to usunięcie wszystkich danych i ponowne uruchomienie kreatora konfiguracji. Kontynuować?')) return;
                      db.areas.clear();
                      db.lifters.clear();
                      db.projects.clear();
                      db.tasks.clear();
                      db.contexts.clear();
                      db.workBlocks.clear();
                      db.events.clear();
                      db.projectNotes.clear();
                      localStorage.removeItem('dopadone-onboarding-complete');
                      localStorage.removeItem('dopadone-tour-complete');
                      window.location.reload();
                    }}
                  >
                    Powtórz onboarding
                  </button>
                </div>
              </div>
            )}

            {activeCategory === 'konteksty' && (
              <div>
                <div className="contexts-list">
                  {contexts.length === 0 && <p className="empty-hint">Brak kontekstów</p>}
                  {contexts.map(ctx => (
                    <div key={ctx.id} className="context-row">
                      <span className="context-icon">{ctx.icon}</span>
                      <span className="context-name">{ctx.name}</span>
                      <button className="delete-btn" onClick={() => onDeleteContext(ctx.id)}>✕</button>
                    </div>
                  ))}
                </div>
                <form className="context-add-form" onSubmit={handleAddContext}>
                  <div className="emoji-picker">
                    {EMOJI_OPTIONS.map(e => (
                      <button
                        key={e}
                        type="button"
                        className={`emoji-btn ${ctxIcon === e ? 'selected' : ''}`}
                        onClick={() => setCtxIcon(e)}
                      >
                        {e}
                      </button>
                    ))}
                  </div>
                  <div className="context-add-row">
                    <input
                      type="text"
                      placeholder="Nazwa kontekstu"
                      value={ctxName}
                      onChange={e => setCtxName(e.target.value)}
                    />
                    <button type="submit">Dodaj</button>
                  </div>
                </form>
              </div>
            )}

            {activeCategory === 'projekty' && (
              <div>
                {projects.filter(p => p.archived).length === 0 && (
                  <p className="empty-hint">Brak zarchiwizowanych projektów</p>
                )}
                {[...projects.filter(p => p.archived)]
                  .sort((a, b) => (b.archivedAt ?? '').localeCompare(a.archivedAt ?? ''))
                  .map(project => (
                    <div key={project.id} className="settings-area-block">
                      <div className="settings-area-row">
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <span className="settings-area-name">{project.name}</span>
                          {project.archivedAt && (
                            <span style={{ display: 'block', fontSize: '0.78em', opacity: 0.55, marginTop: '2px' }}>
                              {new Date(project.archivedAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}
                            </span>
                          )}
                        </div>
                        <button
                          className="sync-btn"
                          style={{ fontSize: '0.85em', flexShrink: 0 }}
                          onClick={() => onRestoreProject(project.id)}
                        >
                          Przywróć
                        </button>
                      </div>
                    </div>
                  ))}
              </div>
            )}

            {activeCategory === 'szablony' && (
              <div>
                <div className="settings-templates-header">
                  <button
                    type="button"
                    className="sync-btn"
                    onClick={() => setShowTemplateForm(v => !v)}
                  >
                    {showTemplateForm ? 'Anuluj' : '+ Nowy szablon'}
                  </button>
                </div>

                {showTemplateForm && (
                  <form className="settings-template-form" onSubmit={handleSaveTemplate}>
                    <div className="form-group">
                      <label>Nazwa szablonu</label>
                      <input
                        type="text"
                        placeholder="np. Praca głęboka"
                        value={tplName}
                        onChange={e => setTplName(e.target.value)}
                        required
                        autoFocus
                      />
                    </div>

                    {areas.length > 0 && (
                      <div className="agenda-filter-section">
                        <span className="agenda-filter-label">Obszary</span>
                        <div className="agenda-filter-checkboxes">
                          {areas.map(a => {
                            const active = tplAreaIds.includes(a.id);
                            return (
                              <button
                                key={a.id}
                                type="button"
                                className={`agenda-filter-pill ${active ? 'active' : ''}`}
                                style={active ? { background: a.color, borderColor: a.color } : { borderColor: a.color, color: a.color }}
                                onClick={() => setTplAreaIds(prev => toggleTplArr(prev, a.id))}
                              >{a.name}</button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    {tplFilteredLifters.length > 0 && (
                      <div className="agenda-filter-section">
                        <span className="agenda-filter-label">Podobszary</span>
                        <div className="agenda-filter-checkboxes">
                          {tplFilteredLifters.map(l => (
                            <button key={l.id} type="button"
                              className={`agenda-filter-pill ${tplLifterIds.includes(l.id) ? 'active' : ''}`}
                              onClick={() => setTplLifterIds(prev => toggleTplArr(prev, l.id))}
                            >{l.name}</button>
                          ))}
                        </div>
                      </div>
                    )}

                    {tplFilteredProjects.length > 0 && (
                      <div className="agenda-filter-section">
                        <span className="agenda-filter-label">Projekty</span>
                        <div className="agenda-filter-checkboxes">
                          {tplFilteredProjects.map(p => (
                            <button key={p.id} type="button"
                              className={`agenda-filter-pill ${tplProjectIds.includes(p.id) ? 'active' : ''}`}
                              onClick={() => setTplProjectIds(prev => toggleTplArr(prev, p.id))}
                            >{p.name}</button>
                          ))}
                        </div>
                      </div>
                    )}

                    {contexts.length > 0 && (
                      <div className="agenda-filter-section">
                        <span className="agenda-filter-label">Konteksty</span>
                        <div className="agenda-filter-checkboxes">
                          {contexts.map(c => (
                            <button key={c.id} type="button"
                              className={`agenda-filter-pill ${tplContextIds.includes(c.id) ? 'active' : ''}`}
                              onClick={() => setTplContextIds(prev => toggleTplArr(prev, c.id))}
                            >{c.icon} {c.name}</button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="agenda-filter-section">
                      <span className="agenda-filter-label">Energia</span>
                      <div className="agenda-filter-checkboxes">
                        {ENERGY_LEVELS.map(e => {
                          const active = tplEffortLevels.includes(e.value);
                          return (
                            <button key={e.value} type="button"
                              className={`agenda-filter-pill ${active ? 'active' : ''}`}
                              style={active ? { background: e.color, borderColor: e.color } : { borderColor: e.color, color: e.color }}
                              onClick={() => setTplEffortLevels(prev => toggleTplArr(prev, e.value))}
                            >{e.label}</button>
                          );
                        })}
                      </div>
                    </div>

                    <div style={{ marginTop: 12 }}>
                      <button type="submit" className="btn-primary">Zapisz szablon</button>
                    </div>
                  </form>
                )}

                <div className="settings-template-list">
                  {blockTemplates.length === 0 && !showTemplateForm && (
                    <p className="empty-hint">Brak zapisanych szablonów</p>
                  )}
                  {blockTemplates.map(tpl => {
                    const tplAreas = areas.filter(a => tpl.areaIds.includes(a.id));
                    const tplLifters = lifters.filter(l => tpl.lifterIds.includes(l.id));
                    const tplProjects = projects.filter(p => tpl.projectIds.includes(p.id));
                    const tplCtxs = contexts.filter(c => tpl.contextIds.includes(c.id));
                    return (
                      <div key={tpl.id} className="settings-template-item">
                        <div className="settings-template-item-header">
                          <span className="settings-template-name">{tpl.name}</span>
                          <button
                            type="button"
                            className="delete-btn"
                            onClick={() => onDeleteBlockTemplate?.(tpl.id)}
                          >✕</button>
                        </div>
                        <div className="settings-template-filter-chips">
                          {tplAreas.map(a => (
                            <span key={a.id} className="template-chip" style={{ background: a.color + '30', borderColor: a.color, color: a.color }}>{a.name}</span>
                          ))}
                          {tplLifters.map(l => (
                            <span key={l.id} className="template-chip">{l.name}</span>
                          ))}
                          {tplProjects.map(p => (
                            <span key={p.id} className="template-chip">{p.name}</span>
                          ))}
                          {tplCtxs.map(c => (
                            <span key={c.id} className="template-chip">{c.icon} {c.name}</span>
                          ))}
                          {(tpl.effortLevels ?? []).map(e => {
                            const lvl = ENERGY_LEVELS.find(l => l.value === e);
                            return lvl ? (
                              <span key={e} className="template-chip" style={{ background: lvl.color + '20', borderColor: lvl.color, color: lvl.color }}>{lvl.label}</span>
                            ) : null;
                          })}
                          {tplAreas.length === 0 && tplLifters.length === 0 && tplProjects.length === 0 && tplCtxs.length === 0 && (tpl.effortLevels ?? []).length === 0 && (
                            <span style={{ fontSize: 11, color: 'var(--text-faint)', fontStyle: 'italic' }}>brak filtrów</span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {activeCategory === 'backup' && (
              <div className="sync-section">
                <label className="sync-label">Eksport / Import</label>
                <p style={{ fontSize: '0.85em', opacity: 0.7, margin: '8px 0 16px' }}>
                  Eksportuj dane do pliku JSON. Możesz je zaimportować na innym urządzeniu.
                </p>

                <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                  <button
                    className="sync-btn"
                    onClick={handleExport}
                    disabled={exporting}
                  >
                    {exporting ? 'Eksportowanie…' : '📤 Eksportuj'}
                  </button>
                  <button
                    className="sync-btn"
                    onClick={() => fileInputRef.current?.click()}
                  >
                    📥 Importuj
                  </button>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".json"
                    style={{ display: 'none' }}
                    onChange={handleFileSelect}
                  />
                </div>

                <div style={{ marginTop: '16px' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.9em' }}>
                    <input
                      type="checkbox"
                      checked={!!exportPassword}
                      onChange={e => setExportPassword(e.target.checked ? ' ' : '')}
                    />
                    Szyfruj plik hasłem (zalecane)
                  </label>
                  {exportPassword && (
                    <input
                      type="password"
                      placeholder="Hasło do pliku"
                      value={exportPassword.trim()}
                      onChange={e => setExportPassword(e.target.value)}
                      style={{ marginTop: '8px', width: '200px' }}
                    />
                  )}
                </div>

                {autoBackup && (
                  <div style={{ marginTop: '20px', padding: '12px', background: 'rgba(75, 90, 75, 0.1)', borderRadius: '6px', fontSize: '0.85em' }}>
                    <p style={{ margin: '0 0 6px' }}>
                      <strong>Auto-backup lokalny:</strong> ✓
                    </p>
                    <p style={{ margin: '0 0 10px', opacity: 0.7 }}>
                      Ostatni: {formatExportDate(autoBackup.exportedAt)}
                    </p>
                    <div style={{ display: 'flex', gap: '8px' }}>
                      <button
                        className="sync-btn"
                        style={{ fontSize: '0.9em' }}
                        onClick={handleRestoreAutoBackup}
                      >
                        Przywróć
                      </button>
                      <button
                        className="sync-btn"
                        style={{ fontSize: '0.9em', opacity: 0.7 }}
                        onClick={handleClearAutoBackup}
                      >
                        Usuń
                      </button>
                    </div>
                  </div>
                )}

                {importFile && (
                  <div className="import-modal-overlay" style={{
                    position: 'fixed',
                    top: 0,
                    left: 0,
                    right: 0,
                    bottom: 0,
                    background: 'rgba(0,0,0,0.6)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    zIndex: 1000,
                  }}>
                    <div className="import-modal" style={{
                      background: 'var(--surface)',
                      border: '1px solid var(--border)',
                      borderRadius: '4px',
                      padding: '20px',
                      maxWidth: '480px',
                      width: '90%',
                      maxHeight: '80vh',
                      overflow: 'auto',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <h3 style={{ margin: 0, fontSize: '14px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>Import danych</h3>
                        <button onClick={resetImport} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>✕</button>
                      </div>

                      <p style={{ fontSize: '0.9em', opacity: 0.8, marginBottom: '12px' }}>
                        Plik: {importFile.name}
                      </p>

                      {importEncrypted && !importData && (
                        <div style={{ marginBottom: '16px' }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                            <input type="checkbox" checked readOnly disabled />
                            Plik jest zaszyfrowany
                          </label>
                          <div style={{ display: 'flex', gap: '8px' }}>
                            <input
                              type="password"
                              placeholder="Hasło"
                              value={importPassword}
                              onChange={e => setImportPassword(e.target.value)}
                              style={{ flex: 1 }}
                            />
                            <button className="sync-btn" onClick={handleDecryptImport}>
                              Odszyfruj
                            </button>
                          </div>
                        </div>
                      )}

                      {importData && (
                        <>
                          <p style={{ fontSize: '0.85em', opacity: 0.7, marginBottom: '12px' }}>
                            Data eksportu: {formatExportDate(importData.exportedAt)}
                          </p>

                          {importPreview && (
                            <div style={{ marginBottom: '16px', padding: '12px', background: 'var(--surface2)', borderRadius: '4px' }}>
                              <p style={{ margin: '0 0 8px', fontWeight: 'bold' }}>Podgląd zmian:</p>
                              <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '0.9em' }}>
                                <li>Obszary: +{importPreview.areas.added} nowe, {importPreview.areas.updated} zmienione</li>
                                <li>Podobszary: +{importPreview.lifters.added} nowe, {importPreview.lifters.updated} zmienione</li>
                                <li>Projekty: +{importPreview.projects.added} nowe, {importPreview.projects.updated} zmienione</li>
                                <li>Zadania: +{importPreview.tasks.added} nowe, {importPreview.tasks.updated} zmienione</li>
                                <li>Konteksty: +{importPreview.contexts.added} nowe, {importPreview.contexts.updated} zmienione</li>
                              </ul>
                            </div>
                          )}

                          <div style={{ marginBottom: '16px' }}>
                            <p style={{ marginBottom: '8px', fontWeight: 'bold' }}>Strategia importu:</p>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px', cursor: 'pointer' }}>
                              <input
                                type="radio"
                                name="importMode"
                                checked={importMode === 'merge'}
                                onChange={() => setImportMode('merge')}
                              />
                              <span>Scal - dodaj nowe, zachowaj istniejące (bezpieczne)</span>
                            </label>
                            <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer' }}>
                              <input
                                type="radio"
                                name="importMode"
                                checked={importMode === 'replace'}
                                onChange={() => setImportMode('replace')}
                              />
                              <span>Nadpisz - usuń wszystko i wczytaj z pliku ⚠️</span>
                            </label>
                          </div>
                        </>
                      )}

                      {importError && (
                        <p style={{ color: '#a33a2a', fontSize: '0.9em', marginBottom: '12px' }}>{importError}</p>
                      )}

                      <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                        <button className="sync-btn" style={{ opacity: 0.7 }} onClick={resetImport}>
                          Anuluj
                        </button>
                        <button
                          className="sync-btn"
                          onClick={handleExecuteImport}
                          disabled={!importData || importing}
                        >
                          {importing ? 'Importowanie…' : 'Importuj'}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
            {activeCategory === 'sync' && (
              <div className="sync-section">
                {!isCloudSchema() && (
                  <div style={{ marginBottom: '24px' }}>
                    <p style={{ margin: '0 0 12px', fontSize: '0.85em', fontWeight: 'bold' }}>Włącz synchronizację</p>
                    <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
                      <div style={{ flex: 1, minWidth: '200px', padding: '12px', background: 'rgba(75,90,75,0.08)', borderRadius: '6px', border: '1px solid rgba(75,90,75,0.2)' }}>
                        <p style={{ margin: '0 0 6px', fontSize: '0.85em', fontWeight: 'bold' }}>Wyślij lokalne dane do chmury</p>
                        <p style={{ margin: '0 0 12px', fontSize: '0.82em', opacity: 0.8 }}>
                          Zakładasz nową bazę w Dexie Cloud. Twoje lokalne dane zostaną tam przesłane.
                        </p>
                        <button
                          className="sync-btn"
                          disabled={migrating}
                          onClick={async () => {
                            if (!confirm('Aplikacja wykona migrację i przeładuje stronę.\n\nUWAGA: Wszelkie dane już istniejące w zdalnej bazie zostaną usunięte i zastąpione danymi lokalnymi.\n\nKontynuować?')) return;
                            setMigrating(true);
                            await migrateToCloudSchema();
                          }}
                        >
                          {migrating ? 'Migrowanie…' : 'Migruj i wyślij'}
                        </button>
                      </div>
                      <div style={{ flex: 1, minWidth: '200px', padding: '12px', background: 'rgba(163,58,42,0.08)', borderRadius: '6px', border: '1px solid rgba(163,58,42,0.2)' }}>
                        <p style={{ margin: '0 0 6px', fontSize: '0.85em', fontWeight: 'bold' }}>Pobierz dane z chmury</p>
                        <p style={{ margin: '0 0 12px', fontSize: '0.82em', opacity: 0.8 }}>
                          Podłączasz się do bazy, która już ma dane. Lokalne dane zostaną usunięte i zastąpione tymi z serwera.
                        </p>
                        <button
                          className="sync-btn"
                          onClick={async () => {
                            if (!confirm('Lokalne dane zostaną usunięte i zastąpione danymi z chmury. Kontynuować?')) return;
                            await connectToExistingCloud();
                          }}
                        >
                          Połącz i zastąp
                        </button>
                      </div>
                    </div>
                  </div>
                )}
                <label className="sync-label">URL bazy Dexie Cloud</label>
                <p style={{ fontSize: '0.85em', opacity: 0.7, margin: '8px 0 12px' }}>
                  Pobierz URL z <a href="https://dexie.cloud" target="_blank" rel="noreferrer">dexie.cloud</a> po założeniu bazy danych.
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '4px' }}>
                  <input
                    type="url"
                    placeholder="https://xxx.dexie.cloud"
                    value={urlDraft}
                    onChange={e => { setUrlDraft(e.target.value); setUrlError(null); }}
                    style={{ flex: 1, minWidth: '200px' }}
                  />
                  <button className="sync-btn" onClick={handleSaveUrl}>
                    Zapisz i przeładuj
                  </button>
                </div>
                {urlError && <p style={{ color: '#a33a2a', fontSize: '0.85em', margin: '4px 0 0' }}>{urlError}</p>}

                {cloudUrl && (
                  <>
                    <div style={{ marginTop: '24px', padding: '12px', background: 'rgba(75, 90, 75, 0.08)', borderRadius: '6px' }}>
                      <p style={{ margin: '0 0 6px', fontSize: '0.85em', fontWeight: 'bold' }}>Status połączenia:</p>
                      {currentUser?.isLoggedIn ? (
                        <div>
                          <p style={{ margin: '0 0 10px', fontSize: '0.9em' }}>
                            Zalogowany jako: {currentUser.email ?? currentUser.userId}
                          </p>
                          <button className="sync-btn" onClick={handleLogout}>
                            Wyloguj
                          </button>
                        </div>
                      ) : (
                        <p style={{ margin: 0, fontSize: '0.9em', opacity: 0.7 }}>Niezalogowany</p>
                      )}
                    </div>

                    {!currentUser?.isLoggedIn && (
                      <div style={{ marginTop: '20px' }}>
                        <label className="sync-label">Logowanie przez email (OTP)</label>
                        {syncStatus === 'idle' && (
                          <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                            <input
                              type="email"
                              placeholder="Email"
                              value={syncEmail}
                              onChange={e => setSyncEmail(e.target.value)}
                              style={{ flex: 1 }}
                            />
                            <button className="sync-btn" onClick={handleLogin}>
                              Wyślij kod
                            </button>
                          </div>
                        )}
                        {syncStatus === 'sending' && (
                          <p style={{ fontSize: '0.9em', opacity: 0.7, marginTop: '8px' }}>Wysyłanie kodu…</p>
                        )}
                        {(syncStatus === 'awaiting-otp' || syncStatus === 'verifying') && (
                          <div style={{ marginTop: '8px' }}>
                            <p style={{ fontSize: '0.85em', opacity: 0.8, marginBottom: '8px' }}>
                              Wpisz kod OTP z emaila ({syncEmail}):
                            </p>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <input
                                type="text"
                                placeholder="Kod OTP"
                                value={syncOtp}
                                onChange={e => setSyncOtp(e.target.value)}
                                style={{ flex: 1 }}
                              />
                              <button
                                className="sync-btn"
                                onClick={handleVerifyOtp}
                                disabled={syncStatus === 'verifying'}
                              >
                                {syncStatus === 'verifying' ? 'Weryfikacja…' : 'Weryfikuj'}
                              </button>
                            </div>
                            <button
                              style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '0.85em', marginTop: '6px', padding: 0 }}
                              onClick={() => { setSyncStatus('idle'); setSyncOtp(''); }}
                            >
                              Wróć
                            </button>
                          </div>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
