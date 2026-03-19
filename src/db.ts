import Dexie, { type Table } from 'dexie'
import type { Area, Lifter, Project, Task, Context } from './types'

export class DopadoneDB extends Dexie {
  areas!: Table<Area>
  lifters!: Table<Lifter>
  projects!: Table<Project>
  tasks!: Table<Task>
  contexts!: Table<Context>

  constructor() {
    super('dopadone');
    this.version(1).stores({
      areas:    '&id, name',
      lifters:  '&id, areaId',
      projects: '&id, areaId, lifterId, parentProjectId',
      tasks:    '&id, projectId, contextId, done',
      contexts: '&id, name',
    });
  }
}

export const db = new DopadoneDB()
