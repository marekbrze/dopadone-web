import type { Project } from '../types';
import type { DragPayload } from '../types';
import { RowMenuButton } from './RowMenuButton';

interface Props {
  projects: Project[];
  selectedProjectId: string | null;
  onSelect: (id: string) => void;
  onDelete?: (id: string) => void;
  onArchive?: (id: string) => void;
  onEdit?: (id: string) => void;
  dragPayload?: DragPayload | null;
  dropTargetProjectId?: string | null;
  dropGapTarget?: string | null;
  onProjectDragStart?: (id: string) => void;
  onProjectDragEnd?: () => void;
  onProjectDragOver?: (e: React.DragEvent, id: string) => void;
  onProjectDrop?: (id: string) => void;
  onProjectDragLeave?: (e: React.DragEvent, id: string) => void;
  onGapDragOver?: (e: React.DragEvent, insertAfterProjectId: string | null) => void;
  onGapDrop?: (insertAfterProjectId: string | null) => void;
  onGapDragLeave?: () => void;
  checkboxMode?: boolean;
  checkedIds?: Set<string>;
  onToggleCheck?: (id: string) => void;
}

export function ProjectTree({ projects, selectedProjectId, onSelect, onDelete, onArchive, onEdit, dragPayload, dropTargetProjectId, dropGapTarget, onProjectDragStart, onProjectDragEnd, onProjectDragOver, onProjectDrop, onProjectDragLeave, onGapDragOver, onGapDrop, onGapDragLeave, checkboxMode, checkedIds, onToggleCheck }: Props) {
  const sorted = [...projects].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const isGapActive = (insertAfterProjectId: string | null) =>
    dropGapTarget === insertAfterProjectId;

  const isDraggingProject = dragPayload?.kind === 'project';

  return (
    <>
      {isDraggingProject && (
        <div
          className={`project-gap-zone${isGapActive(null) ? ' active' : ''}`}
          onDragOver={e => onGapDragOver?.(e, null)}
          onDrop={() => onGapDrop?.(null)}
          onDragLeave={onGapDragLeave}
        />
      )}
      {sorted.map(project => {
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
                className={`project-item${isSelected ? ' selected' : ''}${project.archived ? ' archived' : ''}${checkboxMode && checkedIds?.has(project.id) ? ' checked' : ''}`}
                style={{ paddingLeft: '12px' }}
                draggable
                onDragStart={() => onProjectDragStart?.(project.id)}
                onDragEnd={onProjectDragEnd}
                onClick={() => checkboxMode ? onToggleCheck?.(project.id) : onSelect(project.id)}
              >
                {checkboxMode ? (
                  <span className={`pr-checkbox${checkedIds?.has(project.id) ? ' checked' : ''}`} aria-hidden="true">
                    {checkedIds?.has(project.id) ? '☑' : '☐'}
                  </span>
                ) : null}
                {project.archived && <span className="archived-label">archiwum</span>}
                <span>{project.name}</span>
              </div>
              {!checkboxMode && (
                <RowMenuButton
                  onEdit={onEdit ? () => onEdit(project.id) : undefined}
                  onArchive={onArchive ? () => onArchive(project.id) : undefined}
                  onDelete={onDelete ? () => onDelete(project.id) : undefined}
                />
              )}
            </div>
            {isDraggingProject && (
              <div
                className={`project-gap-zone${isGapActive(project.id) ? ' active' : ''}`}
                onDragOver={e => onGapDragOver?.(e, project.id)}
                onDrop={() => onGapDrop?.(project.id)}
                onDragLeave={onGapDragLeave}
              />
            )}
          </div>
        );
      })}
    </>
  );
}
