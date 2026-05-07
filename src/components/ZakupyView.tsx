import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import type { Area, Project, Task } from '../types';
import { RowMenuButton } from './RowMenuButton';
import { localDateStr } from './dateStepUtils';

function isCompletedToday(task: Task, today: string): boolean {
  if (!task.completedAt) return false;
  return localDateStr(new Date(task.completedAt)) === today;
}

interface Props {
  area: Area;
  projects: Project[];
  tasks: Task[];
  onAddShop: (name: string) => void;
  onRenameShop: (projectId: string, name: string) => void;
  onDeleteShop: (projectId: string) => void;
  onAddItem: (name: string, projectId: string) => void;
  onUpdateItem: (taskId: string, updates: Partial<Task>) => void;
  onDeleteItem: (taskId: string) => void;
  onReorderItem: (taskId: string, afterTaskId: string | null) => void;
}

interface ShopState {
  collapsed: boolean;
  boughtCollapsed: boolean;
  editingName: boolean;
  editingItemId: string | null;
}

export function ZakupyView({
  area,
  projects,
  tasks,
  onAddShop,
  onRenameShop,
  onDeleteShop,
  onAddItem,
  onUpdateItem,
  onDeleteItem,
  onReorderItem,
}: Props) {
  const [shopStates, setShopStates] = useState<Record<string, ShopState>>({});
  const [quickAddValues, setQuickAddValues] = useState<Record<string, string>>({});
  const [newShopName, setNewShopName] = useState('');
  const [addingShop, setAddingShop] = useState(false);
  const [editingNameValue, setEditingNameValue] = useState('');
  const [editingItemValue, setEditingItemValue] = useState('');
  const [dragItemId, setDragItemId] = useState<string | null>(null);
  const [dropTarget, setDropTarget] = useState<string | null>(null);

  const newShopInputRef = useRef<HTMLInputElement>(null);
  const quickAddRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const getShopState = useCallback((id: string): ShopState => {
    return shopStates[id] ?? { collapsed: false, boughtCollapsed: true, editingName: false, editingItemId: null };
  }, [shopStates]);

  const updateShopState = useCallback((id: string, updates: Partial<ShopState>) => {
    setShopStates(prev => ({
      ...prev,
      [id]: { ...getShopState(id), ...updates },
    }));
  }, [getShopState]);

  const shopProjects = projects
    .filter(p => p.areaId === area.id && !p.archived)
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

  const today = useMemo(() => localDateStr(), []);

  const allItems = tasks.filter(t =>
    shopProjects.some(p => p.id === t.projectId)
  );
  const allBought = allItems.length > 0 && allItems.every(t => t.done);

  useEffect(() => {
    if (addingShop && newShopInputRef.current) {
      newShopInputRef.current.focus();
    }
  }, [addingShop]);

  const handleAddShop = () => {
    if (newShopName.trim()) {
      onAddShop(newShopName.trim());
      setNewShopName('');
      setAddingShop(false);
    }
  };

  const handleAddItem = (projectId: string) => {
    const val = quickAddValues[projectId]?.trim();
    if (val) {
      onAddItem(val, projectId);
      setQuickAddValues(prev => ({ ...prev, [projectId]: '' }));
      setTimeout(() => {
        quickAddRefs.current[projectId]?.focus();
      }, 50);
    }
  };

  const startEditShopName = (projectId: string, currentName: string) => {
    setEditingNameValue(currentName);
    updateShopState(projectId, { editingName: true });
  };

  const saveShopName = (projectId: string) => {
    if (editingNameValue.trim()) {
      onRenameShop(projectId, editingNameValue.trim());
    }
    updateShopState(projectId, { editingName: false });
  };

  const startEditItem = (taskId: string, currentName: string) => {
    setEditingItemValue(currentName);
    const projectId = tasks.find(t => t.id === taskId)?.projectId;
    if (projectId) {
      updateShopState(projectId, { editingItemId: taskId });
    }
  };

  const saveItem = (taskId: string, projectId: string) => {
    if (editingItemValue.trim()) {
      onUpdateItem(taskId, { name: editingItemValue.trim() });
    }
    updateShopState(projectId, { editingItemId: null });
  };

  const handleDragEnd = () => {
    setDragItemId(null);
    setDropTarget(null);
  };

  // Empty area state
  if (shopProjects.length === 0) {
    return (
      <div className="zakupy-view">
        <div className="zakupy-empty">
          <p className="zakupy-empty-text">Brak sklepów. Dodaj pierwszy sklep lub kategorię.</p>
          <button
            className="zakupy-add-shop-btn"
            onClick={() => setAddingShop(true)}
          >
            Dodaj sklep
          </button>
          {addingShop && (
            <div className="zakupy-new-shop-inline">
              <input
                ref={newShopInputRef}
                type="text"
                placeholder="Nazwa sklepu..."
                value={newShopName}
                onChange={e => setNewShopName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') handleAddShop();
                  if (e.key === 'Escape') { setAddingShop(false); setNewShopName(''); }
                }}
                onBlur={() => { if (!newShopName.trim()) { setAddingShop(false); } }}
              />
              <button className="zakupy-inline-confirm" onClick={handleAddShop}>Dodaj</button>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="zakupy-view">
      {allBought && (
        <div className="zakupy-all-bought">
          Wszystko kupione
        </div>
      )}

      {shopProjects.map(project => {
        const state = getShopState(project.id);
        const shopTasks = tasks
          .filter(t => t.projectId === project.id)
          .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
        const undone = shopTasks.filter(t => !t.done);
        const done = shopTasks.filter(t => t.done && isCompletedToday(t, today));
        const isEmpty = shopTasks.length === 0;
        const isCollapsed = state.collapsed;

        return (
          <section
            key={project.id}
            className={`zakupy-shop${isCollapsed ? ' collapsed' : ''}`}
          >
            <div className="zakupy-shop-header">
              {state.editingName ? (
                <input
                  className="zakupy-shop-name-input"
                  type="text"
                  value={editingNameValue}
                  onChange={e => setEditingNameValue(e.target.value)}
                  onKeyDown={e => {
                    if (e.key === 'Enter') saveShopName(project.id);
                    if (e.key === 'Escape') updateShopState(project.id, { editingName: false });
                  }}
                  onBlur={() => saveShopName(project.id)}
                  autoFocus
                />
              ) : (
                <button
                  className="zakupy-shop-name"
                  onClick={() => updateShopState(project.id, { collapsed: !state.collapsed })}
                  aria-expanded={!isCollapsed}
                >
                  <span className="zakupy-shop-toggle">
                    {isCollapsed ? '▸' : '▾'}
                  </span>
                  <span className="zakupy-shop-label">{project.name}</span>
                  {undone.length > 0 && (
                    <span className="zakupy-shop-count">{undone.length}</span>
                  )}
                </button>
              )}
              <RowMenuButton
                onEdit={() => startEditShopName(project.id, project.name)}
                onDelete={() => onDeleteShop(project.id)}
              />
            </div>

            {!isCollapsed && (
              <div className="zakupy-shop-body">
                {isEmpty && (
                  <p className="zakupy-shop-empty">Lista jest pusta</p>
                )}

                {undone.map(task => {
                  const isEditing = state.editingItemId === task.id;
                  return (
                    <div
                      key={task.id}
                      className={`zakupy-item${dragItemId === task.id ? ' dragging' : ''}${dropTarget === task.id ? ' drop-above' : ''}`}
                      draggable={!isEditing}
                      onDragStart={() => setDragItemId(task.id)}
                      onDragEnd={handleDragEnd}
                      onDragOver={e => {
                        if (dragItemId && dragItemId !== task.id) {
                          e.preventDefault();
                          setDropTarget(task.id);
                        }
                      }}
                      onDragLeave={() => { if (dropTarget === task.id) setDropTarget(null); }}
                      onDrop={() => {
                        if (dragItemId && dragItemId !== task.id) {
                          onReorderItem(dragItemId, task.id);
                        }
                        handleDragEnd();
                      }}
                    >
                      {isEditing ? (
                        <input
                          className="zakupy-item-edit-input"
                          type="text"
                          value={editingItemValue}
                          onChange={e => setEditingItemValue(e.target.value)}
                          onKeyDown={e => {
                            if (e.key === 'Enter') saveItem(task.id, project.id);
                            if (e.key === 'Escape') updateShopState(project.id, { editingItemId: null });
                          }}
                          onBlur={() => saveItem(task.id, project.id)}
                          autoFocus
                        />
                      ) : (
                        <>
                          <input
                            type="checkbox"
                            className="zakupy-checkbox"
                            checked={false}
                            onChange={() => onUpdateItem(task.id, { done: true })}
                            aria-label={`Kupione: ${task.name}`}
                          />
                          <span
                            className="zakupy-item-name"
                            onClick={() => startEditItem(task.id, task.name)}
                          >
                            {task.name}
                          </span>
                          <button
                            className="zakupy-item-delete"
                            onClick={() => onDeleteItem(task.id)}
                            aria-label={`Usuń ${task.name}`}
                          >
                            ×
                          </button>
                        </>
                      )}
                    </div>
                  );
                })}

                <div className="zakupy-quick-add">
                  <input
                    ref={el => { quickAddRefs.current[project.id] = el; }}
                    type="text"
                    placeholder="Dodaj pozycję..."
                    value={quickAddValues[project.id] ?? ''}
                    onChange={e => setQuickAddValues(prev => ({ ...prev, [project.id]: e.target.value }))}
                    onKeyDown={e => {
                      if (e.key === 'Enter') handleAddItem(project.id);
                      if (e.key === 'Escape') setQuickAddValues(prev => ({ ...prev, [project.id]: '' }));
                    }}
                    aria-label={`Dodaj pozycję do ${project.name}`}
                  />
                </div>

                {done.length > 0 && (
                  <div className="zakupy-bought-section">
                    <button
                      className="zakupy-bought-toggle"
                      onClick={() => updateShopState(project.id, { boughtCollapsed: !state.boughtCollapsed })}
                    >
                      {state.boughtCollapsed ? '▸' : '▾'} Kupione ({done.length})
                    </button>
                    {!state.boughtCollapsed && done.map(task => (
                      <div key={task.id} className="zakupy-item bought">
                        <input
                          type="checkbox"
                          className="zakupy-checkbox"
                          checked={true}
                          onChange={() => onUpdateItem(task.id, { done: false })}
                          aria-label={`Cofnij: ${task.name}`}
                        />
                        <span className="zakupy-item-name">{task.name}</span>
                        <button
                          className="zakupy-item-delete"
                          onClick={() => onDeleteItem(task.id)}
                          aria-label={`Usuń ${task.name}`}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>
        );
      })}

      <div className="zakupy-add-shop">
        {addingShop ? (
          <div className="zakupy-new-shop-inline">
            <input
              ref={newShopInputRef}
              type="text"
              placeholder="Nazwa sklepu..."
              value={newShopName}
              onChange={e => setNewShopName(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter') handleAddShop();
                if (e.key === 'Escape') { setAddingShop(false); setNewShopName(''); }
              }}
              onBlur={() => { if (!newShopName.trim()) setAddingShop(false); }}
              autoFocus
            />
            <button className="zakupy-inline-confirm" onClick={handleAddShop}>Dodaj</button>
          </div>
        ) : (
          <button className="zakupy-add-shop-btn" onClick={() => setAddingShop(true)}>
            + Sklep
          </button>
        )}
      </div>
    </div>
  );
}

