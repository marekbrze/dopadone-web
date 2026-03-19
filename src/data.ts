import type { AppState } from './types';

export const defaultData: AppState = {
  areas: [
    { id: 'a1', name: 'Dom', color: '#4CAF50' },
    { id: 'a2', name: 'Praca', color: '#2196F3' },
    { id: 'a3', name: 'Zdrowie', color: '#FF5722' },
  ],
  lifters: [
    { id: 'l1', name: 'Samochód', areaId: 'a1' },
    { id: 'l2', name: 'Ogród', areaId: 'a1' },
    { id: 'l3', name: 'Remont', areaId: 'a1' },
    { id: 'l4', name: 'Frontend', areaId: 'a2' },
    { id: 'l5', name: 'Backend', areaId: 'a2' },
    { id: 'l6', name: 'Sport', areaId: 'a3' },
    { id: 'l7', name: 'Dieta', areaId: 'a3' },
  ],
  projects: [
    { id: 'p1', name: 'Przegląd techniczny', areaId: 'a1', lifterId: 'l1', parentProjectId: null },
    { id: 'p2', name: 'Wymiana opon', areaId: 'a1', lifterId: 'l1', parentProjectId: null },
    { id: 'p3', name: 'Zakup narzędzi', areaId: 'a1', lifterId: 'l2', parentProjectId: null },
    { id: 'p4', name: 'Redesign strony', areaId: 'a2', lifterId: 'l4', parentProjectId: null },
    { id: 'p5', name: 'Nowe komponenty', areaId: 'a2', lifterId: 'l4', parentProjectId: 'p4' },
    { id: 'p6', name: 'API integracja', areaId: 'a2', lifterId: 'l5', parentProjectId: null },
  ],
  contexts: [
    { id: 'c1', name: 'Telefon', icon: '📞' },
    { id: 'c2', name: 'E-mail', icon: '✉️' },
    { id: 'c3', name: 'Wiadomość', icon: '💬' },
    { id: 'c4', name: 'Projektowanie', icon: '🎨' },
    { id: 'c5', name: 'Komputer', icon: '💻' },
    { id: 'c6', name: 'Na mieście', icon: '🏙️' },
  ],
  tasks: [
    { id: 't1', name: 'Umów wizytę w serwisie', projectId: 'p1', done: false, priority: 'high', notes: '', effort: 'xs', contextId: 'c1' },
    { id: 't2', name: 'Sprawdź datę ważności', projectId: 'p1', done: true, priority: 'medium', notes: '', effort: 's', contextId: null },
    { id: 't3', name: 'Zamów opony online', projectId: 'p2', done: false, priority: 'medium', notes: 'Rozmiar: 205/55 R16', effort: 'm', contextId: 'c5' },
    { id: 't4', name: 'Przygotuj makietę', projectId: 'p4', done: false, priority: 'high', notes: '', effort: 'xl', contextId: 'c4' },
    { id: 't5', name: 'Zrób komponent Button', projectId: 'p5', done: false, priority: 'low', notes: '', effort: 'm', contextId: 'c5' },
    { id: 't6', name: 'Zrób komponent Modal', projectId: 'p5', done: false, priority: 'medium', notes: '', effort: 'l', contextId: 'c5' },
  ],
};

const STORAGE_KEY = 'dopadone-data';

export function loadData(): AppState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as AppState;
      // Migrate: add contexts if missing (old data)
      if (!parsed.contexts) parsed.contexts = defaultData.contexts;
      // Migrate: add effort/contextId to tasks if missing
      parsed.tasks = parsed.tasks.map(t => ({
        ...t,
        effort: t.effort ?? null,
        contextId: t.contextId ?? null,
      }));
      return parsed;
    }
  } catch {}
  return defaultData;
}

export function saveData(data: AppState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
}
