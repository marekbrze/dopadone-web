import Dexie, { type EntityTable } from 'dexie'
import dexieCloud from 'dexie-cloud-addon'
import type { Area, Lifter, Project, Task, Context, WorkBlock, CalendarEvent } from './types'

const getCloudUrl = () => localStorage.getItem('dopadone-cloud-url');
export const isCloudSchema = () => localStorage.getItem('dopadone-schema') === 'cloud';

export class DopadoneDB extends Dexie {
  areas!: EntityTable<Area, 'id'>
  lifters!: EntityTable<Lifter, 'id'>
  projects!: EntityTable<Project, 'id'>
  tasks!: EntityTable<Task, 'id'>
  contexts!: EntityTable<Context, 'id'>
  workBlocks!: EntityTable<WorkBlock, 'id'>
  events!: EntityTable<CalendarEvent, 'id'>

  constructor() {
    const cloudUrl = getCloudUrl();
    const cloud = isCloudSchema();
    super('dopadone', { addons: (cloud || !!cloudUrl) ? [dexieCloud] : [] });

    if (cloud) {
      // @id: Dexie Cloud generates IDs — required for cross-device sync
      this.version(4).stores({
        areas:      '@id, name',
        lifters:    '@id, areaId',
        projects:   '@id, areaId, lifterId, parentProjectId',
        tasks:      '@id, projectId, contextId, done',
        contexts:   '@id, name',
        workBlocks: '@id, date',
        events:     '@id, date',
      });
      this.version(3).stores({
        areas:      '@id, name',
        lifters:    '@id, areaId',
        projects:   '@id, areaId, lifterId, parentProjectId',
        tasks:      '@id, projectId, contextId, done',
        contexts:   '@id, name',
        workBlocks: '@id, date',
        events:     '@id, date',
      });
      this.version(2).stores({
        areas:      '@id, name',
        lifters:    '@id, areaId',
        projects:   '@id, areaId, lifterId, parentProjectId',
        tasks:      '@id, projectId, contextId, done',
        contexts:   '@id, name',
        workBlocks: '@id, date',
        events:     '@id, date',
      });
      this.version(1).stores({
        areas:      '@id, name',
        lifters:    '@id, areaId',
        projects:   '@id, areaId, lifterId, parentProjectId',
        tasks:      '@id, projectId, contextId, done',
        contexts:   '@id, name',
        workBlocks: '@id, date',
      });
    } else {
      // Legacy schema for existing local databases
      this.version(6).stores({
        areas:      'id, name',
        lifters:    'id, areaId',
        projects:   'id, areaId, lifterId, parentProjectId',
        tasks:      'id, projectId, contextId, done',
        contexts:   'id, name',
        workBlocks: 'id, date',
        events:     'id, date',
      });
      this.version(5).stores({
        areas:      'id, name',
        lifters:    'id, areaId',
        projects:   'id, areaId, lifterId, parentProjectId',
        tasks:      'id, projectId, contextId, done',
        contexts:   'id, name',
        workBlocks: 'id, date',
        events:     'id, date',
      });
      this.version(4).stores({
        areas:      'id, name',
        lifters:    'id, areaId',
        projects:   'id, areaId, lifterId, parentProjectId',
        tasks:      'id, projectId, contextId, done',
        contexts:   'id, name',
        workBlocks: 'id, date',
        events:     'id, date',
      });
      this.version(3).stores({
        areas:      'id, name',
        lifters:    'id, areaId',
        projects:   'id, areaId, lifterId, parentProjectId',
        tasks:      'id, projectId, contextId, done',
        contexts:   'id, name',
        workBlocks: 'id, date',
      });
      this.version(2).stores({
        areas:    'id, name',
        lifters:  'id, areaId',
        projects: 'id, areaId, lifterId, parentProjectId',
        tasks:    'id, projectId, contextId, done',
        contexts: 'id, name',
      });
      this.version(1).stores({
        areas:    '&id, name',
        lifters:  '&id, areaId',
        projects: '&id, areaId, lifterId, parentProjectId',
        tasks:    '&id, projectId, contextId, done',
        contexts: '&id, name',
      });
    }

    if (cloudUrl) {
      this.cloud.configure({
        databaseUrl: cloudUrl,
        requireAuth: false,
      });
    }
  }
}

export const db = new DopadoneDB()
