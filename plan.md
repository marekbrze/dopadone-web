# Plan: Mobile Accessibility + Responsive Design

## Podsumowanie

Dostosowanie aplikacji do zasad dostępności (a11y) i responsywnego designu z układem typu pionowy accordion na mobile.

---

## Pliki do zmiany

| Plik | Status | Opis |
|------|--------|------|
| `src/App.tsx` | Zmiana | Stan accordion, atrybuty ARIA |
| `src/App.css` | Zmiana | Media queries, style accordion i overlay |
| `src/components/TaskDetailPanel.tsx` | Zmiana | Obsługa mobile overlay (opcjonalnie) |

---

## Parametry

- **Breakpoint:** 768px (md)
- **Default na mobile:** Pierwsza kolumna (Podobszary) rozwinięta
- **Panel szczegółów:** Pełnoekranowy overlay na mobile

---

## CZĘŚĆ 1: Stan i logika accordion (App.tsx)

### 1.1 Nowy stan

```tsx
const [expandedColumns, setExpandedColumns] = useState<Set<string>>(
  new Set(['lifters']) // domyślnie pierwsza kolumna rozwinięta
);

const toggleColumn = (id: string) => {
  setExpandedColumns(prev => {
    const next = new Set(prev);
    next.has(id) ? next.delete(id) : next.add(id);
    return next;
  });
};
```

### 1.2 Struktura kolumn z ARIA

```tsx
<section 
  className={`column ${expandedColumns.has('lifters') ? 'expanded' : ''}`}
  id="column-lifters"
>
  <div
    className="column-header"
    role="button"
    tabIndex={0}
    aria-expanded={expandedColumns.has('lifters')}
    aria-controls="column-body-lifters"
    onClick={() => toggleColumn('lifters')}
    onKeyDown={e => { 
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        toggleColumn('lifters');
      }
    }}
  >
    <h2>Podobszary</h2>
    <button onClick={e => { e.stopPropagation(); setModal('lifter'); }}>+</button>
  </div>
  <div 
    className="column-body" 
    id="column-body-lifters" 
    role="region"
    aria-labelledby="column-header-lifters"
  >
    {/* content */}
  </div>
</section>
```

### 1.3 ID kolumn

| Kolumna | ID |
|---------|-----|
| Podobszary | `lifters` |
| Projekty | `projects` |
| Zadania | `tasks` |

---

## CZĘŚĆ 2: CSS - Media queries (App.css)

### 2.1 Mobile accordion (<768px)

```css
@media (max-width: 767px) {
  .columns {
    display: flex;
    flex-direction: column;
    overflow-y: auto;
  }

  .column {
    border-right: none;
    border-bottom: 1px solid var(--border-light);
  }

  /* Klikalny nagłówek */
  .column-header {
    cursor: pointer;
    user-select: none;
    position: relative;
  }

  /* Strzałka rozwijania */
  .column-header::after {
    content: '▾';
    margin-left: auto;
    padding-left: 8px;
    font-size: 12px;
    color: var(--text-faint);
    transition: transform 0.2s ease;
  }

  .column.expanded .column-header::after {
    transform: rotate(180deg);
  }

  /* Przycisk + nad ::after */
  .column-header button {
    position: relative;
    z-index: 1;
  }

  /* Zwinięte body */
  .column-body {
    display: none;
    max-height: 0;
    overflow: hidden;
  }

  /* Rozwinięte body */
  .column.expanded .column-body {
    display: block;
    max-height: 50vh;
    overflow-y: auto;
  }

  /* Header na mobile */
  .app-header {
    padding: 0 12px;
    height: 48px;
  }

  .logo {
    font-size: 12px;
    margin-right: 12px;
  }

  .area-tab {
    padding: 14px 12px 12px;
    font-size: 12px;
  }

  /* Settings button - tylko ikona */
  .settings-btn {
    padding: 5px 8px;
    font-size: 0;
  }
  .settings-btn::before {
    content: '⚙';
    font-size: 14px;
  }

  /* Panel detail - overlay */
  .task-detail-panel {
    position: fixed;
    inset: 0;
    z-index: 100;
    max-width: 100%;
    height: 100%;
    border-left: none;
    animation: slideIn 0.2s ease;
  }

  @keyframes slideIn {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }

  .task-detail-panel .detail-header {
    position: sticky;
    top: 0;
    background: var(--surface);
    z-index: 1;
  }

  /* ItemDetailPanel też jako overlay */
  .item-detail-panel {
    position: fixed;
    inset: 0;
    z-index: 100;
    max-width: 100%;
    height: 100%;
    border-left: none;
  }
}
```

### 2.2 Desktop (>=768px) - obecne style

```css
@media (min-width: 768px) {
  .columns {
    display: grid;
    grid-template-columns: 1fr 1fr 1fr;
    transition: grid-template-columns 0.25s ease;
  }

  .columns.panel-open {
    grid-template-columns: 1fr 1fr 1fr 300px;
  }

  /* ... reszta obecnych stylów */
}
```

---

## CZĘŚĆ 3: Panel szczegółów jako overlay

### 3.1 TaskDetailPanel

Na mobile panel zasłania cały ekran:
- `position: fixed; inset: 0; z-index: 100`
- Animacja wejścia: `slideIn` (z prawej)
- Sticky header z przyciskiem zamknij

### 3.2 ARIA dla overlay

```tsx
<div
  className="task-detail-panel"
  role="dialog"
  aria-modal="true"
  aria-labelledby="detail-title"
>
  {/* content */}
</div>
```

### 3.3 ItemDetailPanel

Analogicznie - overlay na mobile dla edycji podobszarów/projektów.

---

## CZĘŚĆ 4: Accessibility checklist

### Nagłówki kolumn
- [x] `aria-expanded="true/false"` na `.column-header`
- [x] `aria-controls="column-body-{id}"` wskazujące na ID body
- [x] `role="button"` na nagłówkach (nie są `<button>`)
- [x] `tabIndex={0}` dla focusu klawiaturowego
- [x] `onKeyDown` - Enter i Space przełączają stan

### Body kolumn
- [x] `role="region"` na `.column-body`
- [x] Unikalne `id` dla powiązania z `aria-controls`
- [x] `aria-labelledby` wskazujące na nagłówek

### Panel overlay
- [x] `role="dialog"` na panelu
- [x] `aria-modal="true"` - blokuje interakcję z tłem
- [x] `aria-labelledby` - tytuł panelu
- [x] Focus trap (opcjonalnie - React nie ma natywnego)
- [x] Escape zamyka panel

### Ogólne
- [x] Widoczny focus indicator (outline)
- [x] Dotykowe cele min. 44x44px
- [x] Kontrast kolorów spełnia WCAG AA (już OK w obecnych stylach)

---

## CZĘŚĆ 5: Dostosowanie headera na mobile

| Element | Zmiana |
|---------|--------|
| `.app-header` | padding: 0 12px, height: 48px |
| `.logo` | font-size: 12px |
| `.area-tabs` | overflow-x: auto (dotykowy scroll) |
| `.area-tab` | padding: 14px 12px 12px, font-size: 12px |
| `.settings-btn` | tylko ikona ⚙, tekst ukryty |

---

## Kolejność implementacji

1. **`src/App.css`** - media queries dla accordion i overlay
2. **`src/App.tsx`** - stan `expandedColumns`, `toggleColumn`, ARIA na nagłówkach
3. **Testy ręczne** - mobile view w DevTools
4. **Opcjonalnie: ItemDetailPanel** - overlay na mobile
5. **Testy accessibility** - klawiatura, screen reader

---

## Szacowany czas

2-3 godziny pracy
