import type { AppState } from './types'
import { db } from './db'

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
}

async function migrateFromLocalStorage(): Promise<AppState | null> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AppState
    if (!parsed.contexts) parsed.contexts = defaultData.contexts
    parsed.tasks = parsed.tasks.map(t => ({
      ...t,
      effort: t.effort ?? null,
      contextId: t.contextId ?? null,
    }))
    await db.transaction('rw', [db.areas, db.lifters, db.projects, db.tasks, db.contexts], async () => {
      await db.areas.bulkPut(parsed.areas)
      await db.lifters.bulkPut(parsed.lifters)
      await db.projects.bulkPut(parsed.projects)
      await db.tasks.bulkPut(parsed.tasks)
      await db.contexts.bulkPut(parsed.contexts)
    })
    localStorage.removeItem(STORAGE_KEY)
    return parsed
  } catch {
    return null
  }
}

export async function loadData(): Promise<AppState> {
  const count = await db.areas.count()
  if (count === 0) {
    const migrated = await migrateFromLocalStorage()
    if (migrated) return migrated
    // Fresh start: seed with defaults
    await db.transaction('rw', [db.areas, db.contexts], async () => {
      await db.areas.bulkAdd(defaultData.areas)
      await db.contexts.bulkAdd(defaultData.contexts)
    })
    return defaultData
  }
  const [areas, lifters, projects, tasks, contexts] = await Promise.all([
    db.areas.toArray(),
    db.lifters.toArray(),
    db.projects.toArray(),
    db.tasks.toArray(),
    db.contexts.toArray(),
  ])
  return { areas, lifters, projects, tasks, contexts }
}
