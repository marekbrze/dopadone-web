import { db } from '../db'
import type { Area, Lifter, Project, Task, Context } from '../types'

const MIGRATION_KEY = 'dopadone-migration-data'

export async function migrateToCloudSchema(): Promise<void> {
  const [areas, lifters, projects, tasks, contexts] = await Promise.all([
    db.areas.toArray(),
    db.lifters.toArray(),
    db.projects.toArray(),
    db.tasks.toArray(),
    db.contexts.toArray(),
  ])

  sessionStorage.setItem(MIGRATION_KEY, JSON.stringify({ areas, lifters, projects, tasks, contexts }))
  localStorage.setItem('dopadone-schema', 'cloud')

  await db.delete()
  window.location.reload()
}

// Re-add all records in topological order, remapping foreign keys to new cloud IDs
export async function completeMigrationIfPending(): Promise<void> {
  const raw = sessionStorage.getItem(MIGRATION_KEY)
  if (!raw) return
  sessionStorage.removeItem(MIGRATION_KEY)

  try {
    const { areas, lifters, projects, tasks, contexts } = JSON.parse(raw) as {
      areas: Area[]; lifters: Lifter[]; projects: Project[]; tasks: Task[]; contexts: Context[]
    }

    // Wipe any existing remote data before pushing local records
    await Promise.all([
      db.tasks.clear(),
      db.contexts.clear(),
      db.projects.clear(),
      db.lifters.clear(),
      db.areas.clear(),
    ])

    const areaIdMap = new Map<string, string>()
    for (const area of areas) {
      const newId = await db.areas.add({ name: area.name, color: area.color }) as string
      areaIdMap.set(area.id, newId)
    }

    const lifterIdMap = new Map<string, string>()
    for (const lifter of lifters) {
      const newId = await db.lifters.add({
        name: lifter.name,
        areaId: areaIdMap.get(lifter.areaId) ?? lifter.areaId,
      }) as string
      lifterIdMap.set(lifter.id, newId)
    }

    // Projects may have self-referencing parentProjectId — add parents first
    const projectIdMap = new Map<string, string>()
    const sorted = sortByParent(projects)
    for (const project of sorted) {
      const newId = await db.projects.add({
        name: project.name,
        areaId: areaIdMap.get(project.areaId) ?? project.areaId,
        lifterId: project.lifterId ? (lifterIdMap.get(project.lifterId) ?? project.lifterId) : null,
        parentProjectId: project.parentProjectId ? (projectIdMap.get(project.parentProjectId) ?? null) : null,
      }) as string
      projectIdMap.set(project.id, newId)
    }

    const contextIdMap = new Map<string, string>()
    for (const context of contexts) {
      const newId = await db.contexts.add({ name: context.name, icon: context.icon }) as string
      contextIdMap.set(context.id, newId)
    }

    for (const task of tasks) {
      await db.tasks.add({
        name: task.name,
        projectId: projectIdMap.get(task.projectId) ?? task.projectId,
        done: task.done,
        priority: task.priority,
        notes: task.notes,
        effort: task.effort,
        contextId: task.contextId ? (contextIdMap.get(task.contextId) ?? task.contextId) : null,
      })
    }
  } catch (err) {
    console.error('Migration restore failed:', err)
  }
}

export async function connectToExistingCloud(): Promise<void> {
  localStorage.setItem('dopadone-schema', 'cloud')
  await db.delete()
  window.location.reload()
}

function sortByParent(projects: Project[]): Project[] {
  const result: Project[] = []
  const visited = new Set<string>()
  const byId = new Map(projects.map(p => [p.id, p]))

  function visit(p: Project) {
    if (visited.has(p.id)) return
    if (p.parentProjectId) {
      const parent = byId.get(p.parentProjectId)
      if (parent) visit(parent)
    }
    visited.add(p.id)
    result.push(p)
  }

  for (const p of projects) visit(p)
  return result
}
