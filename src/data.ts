import type { AppState } from './types'
import { db, isCloudSchema } from './db'

const STORAGE_KEY = 'dopadone-data'

export const defaultData: AppState = {
  areas: [
    { id: crypto.randomUUID(), name: 'Dom', color: '#4CAF50' },
    { id: crypto.randomUUID(), name: 'Praca', color: '#2196F3' },
    { id: crypto.randomUUID(), name: 'Zdrowie', color: '#FF5722' },
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
      effort: t.effort ?? null,
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
  const [areasRaw, lifters, projects, tasks, contexts, workBlocks, events, projectNotes] = await Promise.all([
    db.areas.toArray(),
    db.lifters.toArray(),
    db.projects.toArray(),
    db.tasks.toArray(),
    db.contexts.toArray(),
    db.workBlocks.toArray(),
    db.events.toArray(),
    db.projectNotes.toArray(),
  ])
  const areas = [...areasRaw].sort((a, b) => (a.order ?? Infinity) - (b.order ?? Infinity))
  const migratedTasks = tasks.map(t => ({ ...t, blocking: t.blocking ?? false }))
  return { areas, lifters, projects, tasks: migratedTasks, contexts, workBlocks, events, projectNotes }
}

export async function loadData(): Promise<AppState> {
  const count = await db.areas.count()
  if (count === 0) {
    // Cloud mode: don't seed defaults — data comes from sync
    if (isCloudSchema()) return { areas: [], lifters: [], projects: [], tasks: [], contexts: [], workBlocks: [], events: [], projectNotes: [] }
    const migrated = await migrateFromLocalStorage()
    if (migrated) return migrated
    // Fresh local install: seed with defaults
    await db.transaction('rw', [db.areas, db.contexts, db.workBlocks], async () => {
      await db.areas.bulkAdd(defaultData.areas)
      await db.contexts.bulkAdd(defaultData.contexts)
    })
    return defaultData
  }
  return queryAllData()
}
