import Dexie, { type EntityTable } from 'dexie'
import dexieCloud from 'dexie-cloud-addon'
import type { Area, Lifter, Project, Task, Context, WorkBlock, CalendarEvent, ProjectNote } from './types'

const getCloudUrl = (): string | null => {
  const raw = localStorage.getItem('dopadone-cloud-url');
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return null;
    return raw;
  } catch {
    return null;
  }
};
export const isCloudSchema = () => localStorage.getItem('dopadone-schema') === 'cloud';

export class DopadoneDB extends Dexie {
  areas!: EntityTable<Area, 'id'>
  lifters!: EntityTable<Lifter, 'id'>
  projects!: EntityTable<Project, 'id'>
  tasks!: EntityTable<Task, 'id'>
  contexts!: EntityTable<Context, 'id'>
  workBlocks!: EntityTable<WorkBlock, 'id'>
  events!: EntityTable<CalendarEvent, 'id'>
  projectNotes!: EntityTable<ProjectNote, 'id'>

  constructor() {
    const cloudUrl = getCloudUrl();
    const cloud = isCloudSchema();
    super('dopadone', { addons: (cloud || !!cloudUrl) ? [dexieCloud] : [] });

    if (cloud) {
      // @id: Dexie Cloud generates IDs — required for cross-device sync
      this.version(7).stores({
        areas:        '@id, name',
        lifters:      '@id, areaId',
        projects:     '@id, areaId, lifterId',
        tasks:        '@id, projectId, contextId, done',
        contexts:     '@id, name',
        workBlocks:   '@id, date',
        events:       '@id, date',
        projectNotes: '@id, projectId',
      }).upgrade(tx => {
        return tx.table('projects').toCollection().modify(project => {
          delete project.parentProjectId;
        });
      });
      this.version(6).stores({
        areas:        '@id, name',
        lifters:      '@id, areaId',
        projects:     '@id, areaId, lifterId, parentProjectId',
        tasks:        '@id, projectId, contextId, done',
        contexts:     '@id, name',
        workBlocks:   '@id, date',
        events:       '@id, date',
        projectNotes: '@id, projectId',
      });
      this.version(5).stores({
        areas:        '@id, name',
        lifters:      '@id, areaId',
        projects:     '@id, areaId, lifterId, parentProjectId',
        tasks:        '@id, projectId, contextId, done',
        contexts:     '@id, name',
        workBlocks:   '@id, date',
        events:       '@id, date',
        projectNotes: '@id, projectId',
      });
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
      this.version(9).stores({
        areas:        'id, name',
        lifters:      'id, areaId',
        projects:     'id, areaId, lifterId',
        tasks:        'id, projectId, contextId, done',
        contexts:     'id, name',
        workBlocks:   'id, date',
        events:       'id, date',
        projectNotes: 'id, projectId',
      }).upgrade(tx => {
        return tx.table('projects').toCollection().modify(project => {
          delete project.parentProjectId;
        });
      });
      this.version(8).stores({
        areas:        'id, name',
        lifters:      'id, areaId',
        projects:     'id, areaId, lifterId, parentProjectId',
        tasks:        'id, projectId, contextId, done',
        contexts:     'id, name',
        workBlocks:   'id, date',
        events:       'id, date',
        projectNotes: 'id, projectId',
      });
      this.version(7).stores({
        areas:        'id, name',
        lifters:      'id, areaId',
        projects:     'id, areaId, lifterId, parentProjectId',
        tasks:        'id, projectId, contextId, done',
        contexts:     'id, name',
        workBlocks:   'id, date',
        events:       'id, date',
        projectNotes: 'id, projectId',
      });
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
        requireAuth: true,
      });
    }
  }
}

export const db = new DopadoneDB()
