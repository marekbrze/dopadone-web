import Dexie, { type Table } from 'dexie'
import dexieCloud from 'dexie-cloud-addon'
import type { Area, Lifter, Project, Task, Context } from './types'

const getCloudUrl = () => localStorage.getItem('dopadone-cloud-url');

export class DopadoneDB extends Dexie {
  areas!: Table<Area>
  lifters!: Table<Lifter>
  projects!: Table<Project>
  tasks!: Table<Task>
  contexts!: Table<Context>

  constructor() {
    const cloudUrl = getCloudUrl();
    super('dopadone', { addons: cloudUrl ? [dexieCloud] : [] });
    // Version 2: migration from &id (v1) to @id (v2) schema for cloud sync support
    this.version(2).stores({
      areas:    '@id, name',
      lifters:  '@id, areaId',
      projects: '@id, areaId, lifterId, parentProjectId',
      tasks:    '@id, projectId, contextId, done',
      contexts: '@id, name',
    });
    this.version(1).stores({
      areas:    '&id, name',
      lifters:  '&id, areaId',
      projects: '&id, areaId, lifterId, parentProjectId',
      tasks:    '&id, projectId, contextId, done',
      contexts: '&id, name',
    });
    if (cloudUrl) {
      this.cloud.configure({
        databaseUrl: cloudUrl,
        requireAuth: false, // Don't block local access while cloud auth is pending
      });
    }
  }
}

export const db = new DopadoneDB()
