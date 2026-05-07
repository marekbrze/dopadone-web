import type { AppState, Area, Effort } from './types'
import { db, isCloudSchema } from './db'

const STORAGE_KEY = 'dopadone-data'

function migrateEffort(raw: unknown): Effort | null {
  if (raw === 'low' || raw === 'medium' || raw === 'high') return raw;
  if (raw === 'xs' || raw === 's') return 'low';
  if (raw === 'm') return 'medium';
  if (raw === 'l' || raw === 'xl') return 'high';
  return null;
}

export const defaultData: AppState = {
  areas: [
    { id: crypto.randomUUID(), name: 'Dom', color: '#4CAF50' },
    { id: crypto.randomUUID(), name: 'Praca', color: '#2196F3' },
    { id: crypto.randomUUID(), name: 'Zdrowie', color: '#FF5722' },
    { id: crypto.randomUUID(), name: 'Zakupy', color: '#8B7355', isSystem: true },
  ],
  lifters: [],
  projects: [],
  contexts: [
    { id: crypto.randomUUID(), name: 'Telefon', icon: '📞' },
    { id: crypto.randomUUID(), name: 'E-mail', icon: '✉️' },
    { id: crypto.randomUUID(), name: 'Wiadomość', icon: '💬' },
    { id: crypto.randomUUID(), name: 'Projektowanie', icon: '🎨' },
    { id: crypto.randomUUID(), name: 'Komputer', icon: '💻' },
    { id: crypto.randomUUID(), name: 'Na mieście', icon: '🏙️' },
  ],
  tasks: [],
  workBlocks: [],
  events: [],
  projectNotes: [],
  dailyPractices: [],
}

async function migrateFromLocalStorage(): Promise<AppState | null> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (typeof parsed !== 'object' || parsed === null || !Array.isArray(parsed.areas) || !Array.isArray(parsed.tasks)) return null
    const state = parsed as AppState
    if (!state.contexts) state.contexts = defaultData.contexts
    if (!Array.isArray(state.workBlocks)) state.workBlocks = []
    if (!Array.isArray(state.events)) state.events = []
    state.tasks = state.tasks.map(t => ({
      ...t,
      effort: migrateEffort(t.effort),
      contextId: t.contextId ?? null,
      blocking: t.blocking ?? false,
    }))
    await db.transaction('rw', [db.areas, db.lifters, db.projects, db.tasks, db.contexts, db.workBlocks, db.events, db.projectNotes], async () => {
      await db.areas.bulkPut(state.areas)
      await db.lifters.bulkPut(state.lifters)
      await db.projects.bulkPut(state.projects)
      await db.tasks.bulkPut(state.tasks)
      await db.contexts.bulkPut(state.contexts)
      await db.workBlocks.bulkPut(state.workBlocks)
      await db.events.bulkPut(state.events)
    })
    localStorage.removeItem(STORAGE_KEY)
    return state
  } catch {
    return null
  }
}

export async function queryAllData(): Promise<AppState> {
  const [areasRaw, lifters, projects, tasks, contexts, workBlocks, events, projectNotes, dailyPractices] = await Promise.all([
    db.areas.toArray(),
    db.lifters.toArray(),
    db.projects.toArray(),
    db.tasks.toArray(),
    db.contexts.toArray(),
    db.workBlocks.toArray(),
    db.events.toArray(),
    db.projectNotes.toArray(),
    db.dailyPractice.toArray(),
  ])
  const areas = [...areasRaw].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))
  const migratedTasks = tasks.map(t => ({ ...t, blocking: t.blocking ?? false }))
  return { areas, lifters, projects, tasks: migratedTasks, contexts, workBlocks, events, projectNotes, dailyPractices }
}

export async function isNewUser(): Promise<boolean> {
  if (isCloudSchema()) return false;
  if (localStorage.getItem('dopadone-onboarding-complete') === 'true') return false;
  const count = await db.areas.count();
  return count === 0;
}

export async function seedFromOnboarding(
  areas: Array<{ name: string; color: string }>,
  contexts: Array<{ name: string; icon: string }>,
): Promise<void> {
  const areaRecords = areas.map((a, i) => ({
    id: crypto.randomUUID(),
    name: a.name,
    color: a.color,
    order: i,
  }));
  const contextRecords = contexts.map(c => ({
    id: crypto.randomUUID(),
    name: c.name,
    icon: c.icon,
  }));
  await db.transaction('rw', [db.areas, db.contexts], async () => {
    await db.areas.bulkAdd(areaRecords);
    await db.contexts.bulkAdd(contextRecords);
  });
  localStorage.setItem('dopadone-onboarding-complete', 'true');
}

export async function loadData(): Promise<AppState> {
  const count = await db.areas.count()
  if (count === 0) {
    // Cloud mode: don't seed defaults — data comes from sync
    if (isCloudSchema()) return { areas: [], lifters: [], projects: [], tasks: [], contexts: [], workBlocks: [], events: [], projectNotes: [], dailyPractices: [] }
    const migrated = await migrateFromLocalStorage()
    if (migrated) return ensureSystemAreas(migrated)
    // Fresh local install: seed with defaults
    await db.transaction('rw', [db.areas, db.contexts, db.workBlocks], async () => {
      await db.areas.bulkAdd(defaultData.areas)
      await db.contexts.bulkAdd(defaultData.contexts)
    })
    return defaultData
  }
  return ensureSystemAreas(await queryAllData())
}

let creationLock: Promise<void> | null = null;

async function waitForCloudInSync(timeoutMs = 30000): Promise<'in-sync' | 'skip'> {
  if (!isCloudSchema()) return 'in-sync';
  return new Promise((resolve) => {
    let done = false;
    const finish = (r: 'in-sync' | 'skip') => {
      if (done) return;
      done = true;
      sub.unsubscribe();
      clearTimeout(timer);
      resolve(r);
    };
    const sub = db.cloud.syncState.subscribe((state) => {
      if (state.phase === 'in-sync') finish('in-sync');
      else if (state.phase === 'error' || state.status === 'offline') finish('skip');
    });
    const timer = setTimeout(() => finish('skip'), timeoutMs);
  });
}

export async function ensureSystemAreas(data: AppState): Promise<AppState> {
  const zakupys = data.areas.filter(a => a.isSystem && a.name === 'Zakupy');

  if (zakupys.length > 1) {
    const extras = zakupys.slice(1);
    const extraIds = new Set(extras.map(a => a.id));
    await db.areas.bulkDelete(extras.map(a => a.id));
    return { ...data, areas: data.areas.filter(a => !extraIds.has(a.id)) };
  }

  if (zakupys.length === 1) return data;

  if (creationLock) {
    await creationLock;
    const fresh = await queryAllData();
    const freshZakupys = fresh.areas.filter(a => a.isSystem && a.name === 'Zakupy');
    if (freshZakupys.length >= 1) return fresh;
  }

  let release!: () => void;
  creationLock = new Promise<void>((r) => { release = r; });

  try {
    if (isCloudSchema()) {
      const result = await waitForCloudInSync();
      // Skip creation when offline/error — cloud may already have a system Zakupy we can't see yet
      if (result === 'skip') return data;

      const fresh = await queryAllData();
      const freshZakupys = fresh.areas.filter(a => a.isSystem && a.name === 'Zakupy');
      if (freshZakupys.length >= 1) {
        if (freshZakupys.length > 1) {
          const extras = freshZakupys.slice(1);
          const extraIds = new Set(extras.map(a => a.id));
          await db.areas.bulkDelete(extras.map(a => a.id));
          return { ...fresh, areas: fresh.areas.filter(a => !extraIds.has(a.id)) };
        }
        return fresh;
      }
      const id = await db.areas.add({ name: 'Zakupy', color: '#8B7355', isSystem: true }) as string;
      const zakupy: Area = { id, name: 'Zakupy', color: '#8B7355', isSystem: true };
      return { ...fresh, areas: [...fresh.areas, zakupy] };
    }

    const zakupy: Area = { id: crypto.randomUUID(), name: 'Zakupy', color: '#8B7355', isSystem: true };
    await db.areas.add(zakupy);
    return { ...data, areas: [...data.areas, zakupy] };
  } finally {
    release();
    creationLock = null;
  }
}
