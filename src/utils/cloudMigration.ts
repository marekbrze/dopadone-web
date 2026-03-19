import { db } from '../db'

const MIGRATION_KEY = 'dopadone-migration-data'
const SCHEMA_KEY = 'dopadone-schema'

export const isMigratedToV2 = () => localStorage.getItem(SCHEMA_KEY) === 'v2'

export async function migrateToCloudSchema(): Promise<void> {
  const [areas, lifters, projects, tasks, contexts] = await Promise.all([
    db.areas.toArray(),
    db.lifters.toArray(),
    db.projects.toArray(),
    db.tasks.toArray(),
    db.contexts.toArray(),
  ])

  sessionStorage.setItem(MIGRATION_KEY, JSON.stringify({ areas, lifters, projects, tasks, contexts }))
  localStorage.setItem(SCHEMA_KEY, 'v2')

  await db.delete()
  window.location.reload()
}

export async function completeMigrationIfPending(): Promise<void> {
  const raw = sessionStorage.getItem(MIGRATION_KEY)
  if (!raw) return
  sessionStorage.removeItem(MIGRATION_KEY)

  try {
    const { areas, lifters, projects, tasks, contexts } = JSON.parse(raw)
    await db.transaction('rw', [db.areas, db.lifters, db.projects, db.tasks, db.contexts], async () => {
      await db.areas.bulkPut(areas)
      await db.lifters.bulkPut(lifters)
      await db.projects.bulkPut(projects)
      await db.tasks.bulkPut(tasks)
      await db.contexts.bulkPut(contexts)
    })
  } catch (err) {
    console.error('Migration restore failed:', err)
    // Flag is set, so on next load we won't attempt &id schema — data loss is recoverable via backup
  }
}
