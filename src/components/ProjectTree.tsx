import type { Project } from '../types';

interface Props {
  projects: Project[];
  allProjects: Project[];
  selectedProjectId: string | null;
  onSelect: (id: string) => void;
  depth?: number;
}

export function ProjectTree({ projects, allProjects, selectedProjectId, onSelect, depth = 0 }: Props) {
  return (
    <>
      {projects.map(project => {
        const children = allProjects.filter(p => p.parentProjectId === project.id);
        const isSelected = selectedProjectId === project.id;
        return (
          <div key={project.id}>
            <div
              className={`project-item ${isSelected ? 'selected' : ''}`}
              style={{ paddingLeft: `${12 + depth * 16}px` }}
              onClick={() => onSelect(project.id)}
            >
              {children.length > 0 && <span className="tree-icon">▸</span>}
              <span>{project.name}</span>
            </div>
            {children.length > 0 && (
              <ProjectTree
                projects={children}
                allProjects={allProjects}
                selectedProjectId={selectedProjectId}
                onSelect={onSelect}
                depth={depth + 1}
              />
            )}
          </div>
        );
      })}
    </>
  );
}
