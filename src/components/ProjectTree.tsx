import type { Project } from '../types';
import type { DragPayload } from '../types';
import { RowMenuButton } from './RowMenuButton';

interface GapTarget {
  parentProjectId: string | null;
  insertAfterProjectId: string | null;
}

interface Props {
  projects: Project[];
  allProjects: Project[];
  selectedProjectId: string | null;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => void;
  onEdit?: (id: string) => void;
  depth?: number;
  parentProjectId?: string | null;
  dragPayload?: DragPayload | null;
  dropTargetProjectId?: string | null;
  dropGapTarget?: GapTarget | null;
  onProjectDragStart?: (id: string) => void;
  onProjectDragEnd?: () => void;
  onProjectDragOver?: (e: React.DragEvent, id: string) => void;
  onProjectDrop?: (id: string) => void;
  onProjectDragLeave?: (e: React.DragEvent, id: string) => void;
  onGapDragOver?: (e: React.DragEvent, parentProjectId: string | null, insertAfterProjectId: string | null) => void;
  onGapDrop?: (parentProjectId: string | null, insertAfterProjectId: string | null) => void;
  onGapDragLeave?: () => void;
}

export function ProjectTree({ projects, allProjects, selectedProjectId, onSelect, onDelete, onEdit, depth = 0, parentProjectId = null, dragPayload, dropTargetProjectId, dropGapTarget, onProjectDragStart, onProjectDragEnd, onProjectDragOver, onProjectDrop, onProjectDragLeave, onGapDragOver, onGapDrop, onGapDragLeave }: Props) {
  const sorted = [...projects].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const isGapActive = (insertAfterProjectId: string | null) =>
    dropGapTarget?.parentProjectId === parentProjectId &&
    dropGapTarget?.insertAfterProjectId === insertAfterProjectId;

  const isDraggingProject = dragPayload?.kind === 'project';

  return (
    <>
      {isDraggingProject && (
        <div
          className={`project-gap-zone${isGapActive(null) ? ' active' : ''}`}
          onDragOver={e => onGapDragOver?.(e, parentProjectId, null)}
          onDrop={() => onGapDrop?.(parentProjectId, null)}
          onDragLeave={onGapDragLeave}
        />
      )}
      {sorted.map(project => {
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
                parentProjectId={project.id}
                dragPayload={dragPayload}
                dropTargetProjectId={dropTargetProjectId}
                dropGapTarget={dropGapTarget}
                onProjectDragStart={onProjectDragStart}
                onProjectDragEnd={onProjectDragEnd}
                onProjectDragOver={onProjectDragOver}
                onProjectDrop={onProjectDrop}
                onProjectDragLeave={onProjectDragLeave}
                onGapDragOver={onGapDragOver}
                onGapDrop={onGapDrop}
                onGapDragLeave={onGapDragLeave}
              />
            )}
            {isDraggingProject && (
              <div
                className={`project-gap-zone${isGapActive(project.id) ? ' active' : ''}`}
                onDragOver={e => onGapDragOver?.(e, parentProjectId, project.id)}
                onDrop={() => onGapDrop?.(parentProjectId, project.id)}
                onDragLeave={onGapDragLeave}
              />
            )}
          </div>
        );
      })}
    </>
  );
}
