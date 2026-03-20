export interface Area {
  id: string;
  name: string;
  color: string;
  order?: number;
}

export interface Lifter {
  id: string;
  name: string;
  areaId: string;
}

export interface Project {
  id: string;
  name: string;
  areaId: string;
  lifterId: string | null;
  parentProjectId: string | null;
}

export type Effort = 'xs' | 's' | 'm' | 'l' | 'xl';

export interface Context {
  id: string;
  name: string;
  icon: string;
}

export interface Task {
  id: string;
  name: string;
  projectId: string;
  done: boolean;
  priority: 'low' | 'medium' | 'high';
  notes: string;
  effort: Effort | null;
  contextId: string | null;
}

export interface AppState {
  areas: Area[];
  lifters: Lifter[];
  projects: Project[];
  tasks: Task[];
  contexts: Context[];
}

export interface ExportData {
  version: 1;
  exportedAt: string;
  checksum?: string;
  data: AppState;
}

export type ImportMode = 'merge' | 'replace';

export interface ImportPreview {
  areas: { added: number; updated: number };
  lifters: { added: number; updated: number };
  projects: { added: number; updated: number };
  tasks: { added: number; updated: number };
  contexts: { added: number; updated: number };
}
