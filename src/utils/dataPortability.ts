import type { DopadoneDB } from '../db';
import type { ExportData, ImportPreview, ImportMode, AppState } from '../types';

const AUTO_BACKUP_KEY = 'dopadone-auto-backup';

async function encryptData(plaintext: string, password: string): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt']
  );

  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    enc.encode(plaintext)
  );

  return [salt, iv, new Uint8Array(encrypted)]
    .map(arr => btoa(String.fromCharCode(...arr)))
    .join(':');
}

async function decryptData(encrypted: string, password: string): Promise<string> {
  const enc = new TextEncoder();
  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    throw new Error('Nieprawidłowy format zaszyfrowanych danych');
  }

  const [saltB64, ivB64, ciphertextB64] = parts;
  const salt = new Uint8Array(atob(saltB64).split('').map(c => c.charCodeAt(0)));
  const iv = new Uint8Array(atob(ivB64).split('').map(c => c.charCodeAt(0)));
  const ciphertext = new Uint8Array(atob(ciphertextB64).split('').map(c => c.charCodeAt(0)));

  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    'PBKDF2',
    false,
    ['deriveKey']
  );

  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['decrypt']
  );

  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv },
    key,
    ciphertext
  );

  return new TextDecoder().decode(decrypted);
}

function generateChecksum(data: AppState): string {
  const counts = `${data.areas.length}-${data.lifters.length}-${data.projects.length}-${data.tasks.length}-${data.contexts.length}`;
  return btoa(counts);
}

export async function exportAllData(
  db: DopadoneDB,
  password?: string
): Promise<Blob> {
  const [areas, lifters, projects, tasks, contexts] = await Promise.all([
    db.areas.toArray(),
    db.lifters.toArray(),
    db.projects.toArray(),
    db.tasks.toArray(),
    db.contexts.toArray(),
  ]);

  const data: AppState = { areas, lifters, projects, tasks, contexts };
  const exportData: ExportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    checksum: generateChecksum(data),
    data,
  };

  let content: string;
  if (password && password.trim()) {
    content = await encryptData(JSON.stringify(exportData), password);
  } else {
    content = JSON.stringify(exportData, null, 2);
  }

  return new Blob([content], { type: 'application/json' });
}

export async function parseImportFile(
  file: File,
  password?: string
): Promise<ExportData> {
  const content = await file.text();

  if (password && password.trim()) {
    try {
      const decrypted = await decryptData(content, password);
      return JSON.parse(decrypted);
    } catch {
      throw new Error('Nie udało się odszyfrować pliku. Sprawdź hasło.');
    }
  }

  try {
    return JSON.parse(content);
  } catch {
    throw new Error('Nieprawidłowy format pliku. Plik może być zaszyfrowany.');
  }
}

export async function previewImport(
  db: DopadoneDB,
  data: ExportData
): Promise<ImportPreview> {
  const [existingAreas, existingLifters, existingProjects, existingTasks, existingContexts] = 
    await Promise.all([
      db.areas.toArray(),
      db.lifters.toArray(),
      db.projects.toArray(),
      db.tasks.toArray(),
      db.contexts.toArray(),
    ]);

  const countChanges = <T extends { id: string }>(existing: T[], incoming: T[]) => {
    const existingIds = new Set(existing.map(item => item.id));
    let added = 0;
    let updated = 0;
    for (const item of incoming) {
      if (existingIds.has(item.id)) {
        updated++;
      } else {
        added++;
      }
    }
    return { added, updated };
  };

  return {
    areas: countChanges(existingAreas, data.data.areas),
    lifters: countChanges(existingLifters, data.data.lifters),
    projects: countChanges(existingProjects, data.data.projects),
    tasks: countChanges(existingTasks, data.data.tasks),
    contexts: countChanges(existingContexts, data.data.contexts),
  };
}

export async function executeImport(
  db: DopadoneDB,
  data: ExportData,
  mode: ImportMode
): Promise<void> {
  await db.transaction('rw', [db.areas, db.lifters, db.projects, db.tasks, db.contexts], async () => {
    if (mode === 'replace') {
      await Promise.all([
        db.areas.clear(),
        db.lifters.clear(),
        db.projects.clear(),
        db.tasks.clear(),
        db.contexts.clear(),
      ]);
    }

    await Promise.all([
      db.areas.bulkPut(data.data.areas),
      db.lifters.bulkPut(data.data.lifters),
      db.projects.bulkPut(data.data.projects),
      db.tasks.bulkPut(data.data.tasks),
      db.contexts.bulkPut(data.data.contexts),
    ]);
  });
}

export async function saveAutoBackup(db: DopadoneDB): Promise<void> {
  const [areas, lifters, projects, tasks, contexts] = await Promise.all([
    db.areas.toArray(),
    db.lifters.toArray(),
    db.projects.toArray(),
    db.tasks.toArray(),
    db.contexts.toArray(),
  ]);

  const data: AppState = { areas, lifters, projects, tasks, contexts };
  const exportData: ExportData = {
    version: 1,
    exportedAt: new Date().toISOString(),
    checksum: generateChecksum(data),
    data,
  };

  try {
    const json = JSON.stringify(exportData);
    if (json.length > 4 * 1024 * 1024) {
      console.warn('Auto-backup too large, skipping');
      return;
    }
    localStorage.setItem(AUTO_BACKUP_KEY, json);
  } catch (err) {
    if (err instanceof DOMException && err.name === 'QuotaExceededError') {
      console.warn('localStorage quota exceeded, auto-backup skipped');
    } else {
      throw err;
    }
  }
}

export function loadAutoBackup(): ExportData | null {
  const stored = localStorage.getItem(AUTO_BACKUP_KEY);
  if (!stored) return null;

  try {
    return JSON.parse(stored);
  } catch {
    return null;
  }
}

export function clearAutoBackup(): void {
  localStorage.removeItem(AUTO_BACKUP_KEY);
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function formatExportDate(iso: string): string {
  try {
    return new Date(iso).toLocaleString('pl-PL', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

export function isEncryptedFile(content: string): boolean {
  try {
    JSON.parse(content);
    return false;
  } catch {
    return content.includes(':') && content.split(':').length === 3;
  }
}
