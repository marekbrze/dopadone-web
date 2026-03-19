import Dexie, { type Table } from 'dexie'
import dexieCloud from 'dexie-cloud-addon'
import type { Area, Lifter, Project, Task, Context } from './types'

const getCloudUrl = () => localStorage.getItem('dopadone-cloud-url');
export const isSchemaV2 = () => localStorage.getItem('dopadone-schema') === 'v2';

export class DopadoneDB extends Dexie {
  areas!: Table<Area>
  lifters!: Table<Lifter>
  projects!: Table<Project>
  tasks!: Table<Task>
  contexts!: Table<Context>

  constructor() {
    const cloudUrl = getCloudUrl();
    const v2 = isSchemaV2();
    super('dopadone', { addons: cloudUrl ? [dexieCloud] : [] });
    // v2: @id = cloud-synced auto-generated primary key (requires fresh DB — see cloudMigration.ts)
    // v1: &id = explicit unique primary key (legacy, no cloud sync)
    this.version(1).stores(v2 ? {
      areas:    '@id, name',
      lifters:  '@id, areaId',
      projects: '@id, areaId, lifterId, parentProjectId',
      tasks:    '@id, projectId, contextId, done',
      contexts: '@id, name',
    } : {
      areas:    '&id, name',
      lifters:  '&id, areaId',
      projects: '&id, areaId, lifterId, parentProjectId',
      tasks:    '&id, projectId, contextId, done',
      contexts: '&id, name',
    });
    if (cloudUrl) {
      this.cloud.configure({
        databaseUrl: cloudUrl,
        requireAuth: false,
      });
    }
  }
}

export const db = new DopadoneDB()
