import { useState, useEffect, useRef } from 'react';
import type { Area, Lifter, Context, ExportData, ImportPreview, ImportMode } from '../types';
import { db } from '../db';
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
  onDeleteArea: (id: string) => void;
  onDeleteLifter: (id: string) => void;
  onReorderAreas: (fromIndex: number, toIndex: number) => void;
  onAddContext: (name: string, icon: string) => void;
  onDeleteContext: (id: string) => void;
  onClose: () => void;
}

const EMOJI_OPTIONS = ['📞', '✉️', '💬', '🎨', '💻', '🏙️', '🛒', '📝', '🔧', '📱', '🤝', '📚', '🏠', '🚗', '💡', '⚡'];

const validateDexieCloudUrl = (url: string): { valid: boolean; error?: string } => {
  if (!url.trim()) return { valid: true };
  try {
    const parsed = new URL(url);
    if (!parsed.hostname.endsWith('.dexie.cloud')) {
      return { valid: false, error: 'URL musi kończyć się na .dexie.cloud' };
    }
    return { valid: true };
  } catch {
    return { valid: false, error: 'Nieprawidłowy format URL' };
  }
};

export function SettingsModal({
  areas, lifters, contexts,
  onDeleteArea, onDeleteLifter, onReorderAreas,
  onAddContext, onDeleteContext, onClose,
}: Props) {
  const [activeCategory, setActiveCategory] = useState<'obszary' | 'konteksty' | 'sync'>('obszary');
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const [ctxName, setCtxName] = useState('');
  const [ctxIcon, setCtxIcon] = useState('📝');

  // Sync state
  const [cloudUrl, setCloudUrl] = useState(() => localStorage.getItem('dopadone-cloud-url') ?? '');
  const [urlDraft, setUrlDraft] = useState(() => localStorage.getItem('dopadone-cloud-url') ?? '');
  const [urlError, setUrlError] = useState<string | null>(null);
  const [syncEmail, setSyncEmail] = useState('');
  const [syncStatus, setSyncStatus] = useState<'idle' | 'sending' | 'error'>('idle');
  const [syncError, setSyncError] = useState('');
  const [currentUser, setCurrentUser] = useState<{ email?: string; isLoggedIn: boolean } | null>(null);

  // Export/import state
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

  // Auto-backup state
  const [autoBackup, setAutoBackup] = useState<ExportData | null>(null);

  useEffect(() => {
    if (!cloudUrl) return;
    const sub = db.cloud.currentUser.subscribe(user => {
      setCurrentUser({ email: user.email, isLoggedIn: user.isLoggedIn ?? false });
    });
    return () => sub.unsubscribe();
  }, [cloudUrl]);

  useEffect(() => {
    setAutoBackup(loadAutoBackup());
  }, []);

  const handleSaveUrl = () => {
    const trimmed = urlDraft.trim();
    const validation = validateDexieCloudUrl(trimmed);
    
    if (!validation.valid) {
      setUrlError(validation.error ?? 'Nieprawidłowy URL');
      return;
    }
    
    setUrlError(null);
    
    if (trimmed) {
      localStorage.setItem('dopadone-cloud-url', trimmed);
    } else {
      localStorage.removeItem('dopadone-cloud-url');
    }
    setCloudUrl(trimmed);
    window.location.reload();
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!syncEmail.trim()) return;
    setSyncStatus('sending');
    setSyncError('');
    try {
      await db.cloud.login({ email: syncEmail.trim() });
      setSyncStatus('idle');
      setSyncEmail('');
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Błąd logowania');
      setSyncStatus('error');
    }
  };

  const handleLogout = async () => {
    try {
      await db.cloud.logout();
    } catch (err) {
      setSyncError(err instanceof Error ? err.message : 'Błąd wylogowania');
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

  // Export/Import handlers
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
                : 'Synchronizacja między urządzeniami'}
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

            {activeCategory === 'sync' && (
              <div className="sync-section">
                {/* URL configuration */}
                <div className="sync-url-block">
                  <label className="sync-label">Adres bazy Dexie Cloud</label>
                  <p style={{ fontSize: '0.82em', opacity: 0.6, margin: '4px 0 10px' }}>
                    Załóż własną bazę bezpłatnie na{' '}
                    <strong>dexie.cloud</strong> i wklej URL poniżej.
                    Bez URL dane pozostaną wyłącznie lokalnie.
                  </p>
                  <div className="sync-login-form">
                    <input
                      type="url"
                      placeholder="https://twoja-baza.dexie.cloud"
                      value={urlDraft}
                      onChange={e => { setUrlDraft(e.target.value); setUrlError(null); }}
                    />
                    <button
                      type="button"
                      className="sync-btn"
                      onClick={handleSaveUrl}
                      disabled={urlDraft.trim() === cloudUrl}
                    >
                      Zapisz
                    </button>
                  </div>
                  {urlError && (
                    <p style={{ marginTop: '6px', color: '#a33a2a', fontSize: '0.85em' }}>{urlError}</p>
                  )}
                  {cloudUrl && (
                    <p style={{ marginTop: '6px', fontSize: '0.78em', opacity: 0.5 }}>
                      Aktywny URL: {cloudUrl}
                    </p>
                  )}
                </div>

                {/* Security warning */}
                {cloudUrl && (
                  <div className="sync-security-info" style={{ 
                    marginTop: '12px', 
                    padding: '10px', 
                    background: 'rgba(163, 58, 42, 0.1)', 
                    borderRadius: '6px',
                    fontSize: '0.85em'
                  }}>
                    <p style={{ margin: '0 0 6px', color: '#a33a2a' }}>
                      ⚠️ Nie udostępniaj URL bazy osobom niepowołanym.
                    </p>
                    <a 
                      href="https://dexie.org/cloud/docs/access-control" 
                      target="_blank" 
                      rel="noopener noreferrer"
                      style={{ color: '#6b8a6e' }}
                    >
                      📖 Jak skonfigurować dostęp do bazy
                    </a>
                  </div>
                )}

                {/* Login/logout */}
                {cloudUrl && (
                  <div className="sync-login-block">
                    <div className="sync-divider" />
                    {currentUser?.isLoggedIn ? (
                      <div className="sync-logged-in">
                        <p>Zalogowano jako: <strong>{currentUser.email}</strong></p>
                        <p style={{ marginTop: '4px', opacity: 0.65, fontSize: '0.85em' }}>
                          Dane synchronizują się automatycznie między urządzeniami.
                        </p>
                        <button className="sync-btn" style={{ marginTop: '12px' }} onClick={handleLogout}>
                          Wyloguj
                        </button>
                      </div>
                    ) : (
                      <div>
                        <p style={{ marginBottom: '10px', opacity: 0.8, fontSize: '0.9em' }}>
                          Zaloguj się przez e-mail, aby uruchomić synchronizację.
                        </p>
                        <form className="sync-login-form" onSubmit={handleLogin}>
                          <input
                            type="email"
                            placeholder="adres@email.com"
                            value={syncEmail}
                            onChange={e => setSyncEmail(e.target.value)}
                            disabled={syncStatus === 'sending'}
                          />
                          <button
                            type="submit"
                            className="sync-btn"
                            disabled={syncStatus === 'sending' || !syncEmail.trim()}
                          >
                            {syncStatus === 'sending' ? 'Wysyłanie…' : 'Zaloguj się'}
                          </button>
                        </form>
                        {syncError && (
                          <p style={{ marginTop: '6px', color: '#a33a2a', fontSize: '0.85em' }}>{syncError}</p>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* Backup section */}
                <div className="sync-divider" style={{ marginTop: '20px' }} />
                <div className="sync-backup-block" style={{ marginTop: '16px' }}>
                  <label className="sync-label">Kopia zapasowa</label>
                  
                  <div style={{ display: 'flex', gap: '10px', marginTop: '12px', flexWrap: 'wrap' }}>
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

                  <div style={{ marginTop: '12px' }}>
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

                  {/* Auto-backup info */}
                  <div style={{ marginTop: '16px', padding: '10px', background: 'rgba(75, 90, 75, 0.1)', borderRadius: '6px', fontSize: '0.85em' }}>
                    <p style={{ margin: '0 0 6px', opacity: 0.8 }}>
                      <strong>Auto-backup lokalny:</strong> {autoBackup ? '✓' : '✗'}
                    </p>
                    {autoBackup && (
                      <>
                        <p style={{ margin: '0 0 8px', opacity: 0.7 }}>
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
                      </>
                    )}
                  </div>
                </div>

                {/* Import modal */}
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
                      background: '#2a2e2a',
                      borderRadius: '8px',
                      padding: '20px',
                      maxWidth: '480px',
                      width: '90%',
                      maxHeight: '80vh',
                      overflow: 'auto',
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '16px' }}>
                        <h3 style={{ margin: 0 }}>Import danych</h3>
                        <button onClick={resetImport} style={{ background: 'none', border: 'none', color: '#ccc', cursor: 'pointer' }}>✕</button>
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
                            <div style={{ marginBottom: '16px', padding: '12px', background: 'rgba(0,0,0,0.2)', borderRadius: '6px' }}>
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
          </div>
        </div>
      </div>
    </div>
  );
}