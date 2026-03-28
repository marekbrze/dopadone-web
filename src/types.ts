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
  order?: number;
  archived?: boolean;
  archivedAt?: string | null;  // ISO 8601
}

export type Effort = 'xs' | 's' | 'm' | 'l' | 'xl';

export type TaskDuration = 5 | 10 | 15 | 25 | 45 | 60 | 90 | 120;

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
  startDate?: string | null;    // "YYYY-MM-DD"
  endDate?: string | null;      // "YYYY-MM-DD"
  plannedDate?: string | null;  // "YYYY-MM-DD" — dzień, na który zadanie jest zaplanowane
  duration?: TaskDuration | null;
  order?: number;
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
  notes?: string;
}

export interface BlockTemplate {
  id: string;
  name: string;
  areaIds: string[];
  lifterIds: string[];
  projectIds: string[];
  contextIds: string[];
}

export interface CalendarEvent {
  id: string;
  title: string;
  date: string;              // "YYYY-MM-DD" start date
  endDate?: string | null;   // "YYYY-MM-DD" for multi-day (null/undefined = same day)
  allDay: boolean;
  startMinutes?: number;     // undefined when allDay
  endMinutes?: number;       // undefined when allDay
  projectId: string | null;  // null → tasks go to inbox
  taskIds: string[];         // action point task IDs
  notes?: string;
}

export interface ProjectNote {
  id: string;
  projectId: string;
  title?: string | null;
  content: string;
  createdAt: string;  // ISO 8601
  updatedAt: string;  // ISO 8601
  order?: number;
}

export interface AppState {
  areas: Area[];
  lifters: Lifter[];
  projects: Project[];
  tasks: Task[];
  contexts: Context[];
  workBlocks: WorkBlock[];
  events: CalendarEvent[];
  projectNotes: ProjectNote[];
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
  events: { added: number; updated: number };
}
