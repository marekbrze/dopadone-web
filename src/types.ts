export type DragPayload =
  | { kind: 'task'; taskId: string }
  | { kind: 'project'; projectId: string };

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
  startDate?: string | null;  // "YYYY" | "YYYY-MM" | "YYYY-MM-DD"
  endDate?: string | null;    // "YYYY-MM-DD"
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
  projectId: string | null;
  done: boolean;
  priority: 'low' | 'medium' | 'high';
  notes: string;
  effort: Effort | null;
  contextId: string | null;
  blocking: boolean;
}

export interface WorkBlock {
  id: string;
  title: string;
  date: string;           // "YYYY-MM-DD"
  startMinutes: number;   // minutes from midnight
  endMinutes: number;
  blockType?: 'auto' | 'manual'; // undefined treated as 'auto'
  taskIds?: string[];             // only used when blockType === 'manual'
  areaIds: string[];
  lifterIds: string[];
  projectIds: string[];
  contextIds: string[];
  color?: string;
}

export interface AppState {
  areas: Area[];
  lifters: Lifter[];
  projects: Project[];
  tasks: Task[];
  contexts: Context[];
  workBlocks: WorkBlock[];
}

export interface ExportData {
  version: 1 | 2;
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
  workBlocks: { added: number; updated: number };
}
