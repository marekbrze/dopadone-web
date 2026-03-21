import type { Project } from '../types';
import type { DragPayload } from '../types';
import { RowMenuButton } from './RowMenuButton';

interface Props {
  projects: Project[];
  allProjects: Project[];
  selectedProjectId: string | null;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;
  depth?: number;
  dragPayload?: DragPayload | null;
  dropTargetProjectId?: string | null;
  onProjectDragStart?: (id: string) => void;
  onProjectDragEnd?: () => void;
  onProjectDragOver?: (e: React.DragEvent, id: string) => void;
  onProjectDrop?: (id: string) => void;
  onProjectDragLeave?: (e: React.DragEvent, id: string) => void;
}

export function ProjectTree({ projects, allProjects, selectedProjectId, onSelect, onDelete, onEdit, depth = 0, dragPayload, dropTargetProjectId, onProjectDragStart, onProjectDragEnd, onProjectDragOver, onProjectDrop, onProjectDragLeave }: Props) {
  return (
    <>
      {projects.map(project => {
        const children = allProjects.filter(p => p.parentProjectId === project.id);
        const isSelected = selectedProjectId === project.id;
        return (
          <div key={project.id}>
            <div
              className={`project-item-row${dropTargetProjectId === project.id ? ' drop-target-active' : ''}`}
              onDragOver={e => onProjectDragOver?.(e, project.id)}
              onDrop={() => onProjectDrop?.(project.id)}
              onDragLeave={e => onProjectDragLeave?.(e, project.id)}
            >
              <div
                className={`project-item ${isSelected ? 'selected' : ''}`}
                style={{ paddingLeft: `${12 + depth * 16}px` }}
                draggable
                onDragStart={() => onProjectDragStart?.(project.id)}
                onDragEnd={onProjectDragEnd}
                onClick={() => onSelect(project.id)}
              >
                {children.length > 0 && <span className="tree-icon">▸</span>}
                <span>{project.name}</span>
              </div>
              <RowMenuButton
                onEdit={onEdit ? () => onEdit(project.id) : undefined}
                onDelete={onDelete ? () => onDelete(project.id) : undefined}
              />
            </div>
            {children.length > 0 && (
              <ProjectTree
                projects={children}
                allProjects={allProjects}
                selectedProjectId={selectedProjectId}
                onSelect={onSelect}
                onDelete={onDelete}
                onEdit={onEdit}
                depth={depth + 1}
                dragPayload={dragPayload}
                dropTargetProjectId={dropTargetProjectId}
                onProjectDragStart={onProjectDragStart}
                onProjectDragEnd={onProjectDragEnd}
                onProjectDragOver={onProjectDragOver}
                onProjectDrop={onProjectDrop}
                onProjectDragLeave={onProjectDragLeave}
              />
            )}
          </div>
        );
      })}
    </>
  );
}
