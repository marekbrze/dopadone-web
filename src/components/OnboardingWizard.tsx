import { useState, useRef, useEffect } from 'react';
import './OnboardingWizard.css';

export interface OnboardingResult {
  areas: Array<{ name: string; color: string }>;
  contexts: Array<{ name: string; icon: string }>;
  firstProject?: { name: string; areaName: string };
}

interface Props {
  onComplete: (result: OnboardingResult) => void;
  onSkip: () => void;
}

type Step = 'welcome' | 'areas' | 'contexts' | 'project';

const AREA_PALETTE = [
  '#6b7c5a', '#4a6a7a', '#7a5a4a', '#7a6a3a',
  '#4a7a6a', '#5a4a7a', '#7a4a5a', '#6a7a4a',
];

const AREA_SUGGESTIONS = [
  { name: 'Dom', icon: '🏠', color: '#6b7c5a' },
  { name: 'Praca', icon: '💼', color: '#4a6a7a' },
  { name: 'Zdrowie', icon: '🏃', color: '#7a5a4a' },
  { name: 'Finanse', icon: '💰', color: '#7a6a3a' },
  { name: 'Sport', icon: '⚽', color: '#4a7a6a' },
  { name: 'Edukacja', icon: '📚', color: '#5a4a7a' },
  { name: 'Hobby', icon: '🎨', color: '#7a4a5a' },
  { name: 'Rodzina', icon: '👨‍👩‍👧', color: '#6a7a4a' },
];

const DEFAULT_CONTEXTS = [
  { name: 'Telefon', icon: '📞' },
  { name: 'E-mail', icon: '✉️' },
  { name: 'Wiadomość', icon: '💬' },
  { name: 'Projektowanie', icon: '🎨' },
  { name: 'Komputer', icon: '💻' },
  { name: 'Na mieście', icon: '🏙️' },
];

const STEPS: Step[] = ['welcome', 'areas', 'contexts', 'project'];
const STEP_LABELS: Record<Step, string> = {
  welcome: 'Powitanie',
  areas: 'Obszary',
  contexts: 'Konteksty',
  project: 'Projekt',
};

export function OnboardingWizard({ onComplete, onSkip }: Props) {
  const [step, setStep] = useState<Step>('welcome');
  const [selectedAreas, setSelectedAreas] = useState<Set<string>>(new Set());
  const [customAreaInput, setCustomAreaInput] = useState('');
  const [pendingColor, setPendingColor] = useState(AREA_PALETTE[0]);
  const [customAreas, setCustomAreas] = useState<Array<{ name: string; color: string }>>([]);
  const [selectedContexts, setSelectedContexts] = useState<Set<string>>(
    new Set(DEFAULT_CONTEXTS.map(c => c.name))
  );
  const [customContextInput, setCustomContextInput] = useState('');
  const [customContextIcon, setCustomContextIcon] = useState('📝');
  const [customContexts, setCustomContexts] = useState<Array<{ name: string; icon: string }>>([]);
  const [projectName, setProjectName] = useState('');
  const [projectAreaName, setProjectAreaName] = useState('');

  const cardRef = useRef<HTMLDivElement>(null);
  const customAreaRef = useRef<HTMLInputElement>(null);
  const customContextRef = useRef<HTMLInputElement>(null);

  // Focus card on mount for accessibility
  useEffect(() => {
    cardRef.current?.focus();
  }, []);

  // Set default project area when entering project step
  useEffect(() => {
    if (step === 'project' && !projectAreaName) {
      const allAreas = getSelectedAreaObjects();
      if (allAreas.length > 0) setProjectAreaName(allAreas[0].name);
    }
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  const getSelectedAreaObjects = () => {
    const fromSuggestions = AREA_SUGGESTIONS.filter(s => selectedAreas.has(s.name));
    return [...fromSuggestions, ...customAreas];
  };

  const addCustomArea = () => {
    const name = customAreaInput.trim();
    if (!name) return;
    if (AREA_SUGGESTIONS.some(s => s.name.toLowerCase() === name.toLowerCase())) {
      setSelectedAreas(prev => new Set([...prev, AREA_SUGGESTIONS.find(s => s.name.toLowerCase() === name.toLowerCase())!.name]));
    } else if (!customAreas.some(a => a.name.toLowerCase() === name.toLowerCase())) {
      setCustomAreas(prev => [...prev, { name, color: pendingColor }]);
      const nextColor = AREA_PALETTE[(AREA_PALETTE.indexOf(pendingColor) + 1) % AREA_PALETTE.length];
      setPendingColor(nextColor);
    }
    setCustomAreaInput('');
  };

  const addCustomContext = () => {
    const name = customContextInput.trim();
    if (!name) return;
    if (!customContexts.some(c => c.name.toLowerCase() === name.toLowerCase())) {
      setCustomContexts(prev => [...prev, { name, icon: customContextIcon }]);
    }
    setCustomContextInput('');
  };

  const removeCustomArea = (name: string) => {
    setCustomAreas(prev => prev.filter(a => a.name !== name));
  };

  const removeCustomContext = (name: string) => {
    setCustomContexts(prev => prev.filter(c => c.name !== name));
  };

  const totalAreaCount = selectedAreas.size + customAreas.length;

  const handleComplete = () => {
    const areas = getSelectedAreaObjects();
    const contexts = [
      ...DEFAULT_CONTEXTS.filter(c => selectedContexts.has(c.name)),
      ...customContexts,
    ];
    const firstProject = projectName.trim() && projectAreaName
      ? { name: projectName.trim(), areaName: projectAreaName }
      : undefined;
    onComplete({ areas, contexts, firstProject });
  };

  const goNext = () => {
    if (step === 'welcome') setStep('areas');
    else if (step === 'areas') setStep('contexts');
    else if (step === 'contexts') setStep('project');
    else handleComplete();
  };

  const goBack = () => {
    if (step === 'areas') setStep('welcome');
    else if (step === 'contexts') setStep('areas');
    else if (step === 'project') setStep('contexts');
  };

  return (
    <div className="onboarding-overlay" role="dialog" aria-modal="true" aria-labelledby="onboarding-title">
      <div className="onboarding-card" ref={cardRef} tabIndex={-1}>

        {step === 'welcome' && (
          <div className="onboarding-step">
            <div className="onboarding-wordmark">Dopadone</div>
            <div>
              <div className="onboarding-tagline">
                Twoje obszary życia.<br />
                Twoje projekty.<br />
                <strong>Twoje zadania.</strong>
              </div>
            </div>
            <div className="onboarding-hierarchy" aria-label="Struktura: Obszary, Projekty, Zadania">
              <span>Obszary</span>
              <span className="sep">→</span>
              <span>Projekty</span>
              <span className="sep">→</span>
              <span>Zadania</span>
            </div>
            <div className="onboarding-nav">
              <button className="onboarding-skip-link" onClick={onSkip} type="button">
                Pomiń konfigurację
              </button>
              <button className="onboarding-cta" onClick={goNext} type="button" autoFocus>
                Zaczynamy →
              </button>
            </div>
          </div>
        )}

        {step === 'areas' && (
          <div className="onboarding-step">
            <div>
              <div className="onboarding-progress" aria-label={`Krok 2 z ${STEPS.length}`}>
                {STEPS.slice(1).map((s, i) => (
                  <div
                    key={s}
                    className={`onboarding-dot ${i === 0 ? 'active' : ''}`}
                    title={STEP_LABELS[s]}
                  />
                ))}
              </div>
            </div>
            <div>
              <div className="onboarding-title" id="onboarding-title">Wybierz swoje obszary życia</div>
              <div className="onboarding-subtitle">Możesz je zmienić w dowolnej chwili w Ustawieniach.</div>
            </div>
            <div className="area-chips" role="group" aria-label="Sugestie obszarów">
              {AREA_SUGGESTIONS.map(area => {
                const isSelected = selectedAreas.has(area.name);
                return (
                  <button
                    key={area.name}
                    type="button"
                    className={`area-chip ${isSelected ? 'selected' : ''}`}
                    style={isSelected ? { borderColor: area.color, background: `${area.color}18` } : {}}
                    onClick={() => setSelectedAreas(prev => {
                      const next = new Set(prev);
                      if (next.has(area.name)) next.delete(area.name);
                      else next.add(area.name);
                      return next;
                    })}
                    aria-pressed={isSelected}
                  >
                    <span className="area-chip-icon">{area.icon}</span>
                    {area.name}
                  </button>
                );
              })}
              {customAreas.map(area => (
                <button
                  key={area.name}
                  type="button"
                  className="area-chip selected"
                  style={{ borderColor: area.color, background: `${area.color}18` }}
                  onClick={() => removeCustomArea(area.name)}
                  aria-pressed={true}
                  title="Kliknij, aby usunąć"
                >
                  {area.name} ×
                </button>
              ))}
            </div>
            <div>
              <div className="color-swatch-label">Kolor dla nowego obszaru:</div>
              <div className="color-swatches" role="group" aria-label="Wybierz kolor">
                {AREA_PALETTE.map(color => (
                  <button
                    key={color}
                    type="button"
                    className={`color-swatch ${pendingColor === color ? 'selected' : ''}`}
                    style={{ background: color }}
                    onClick={() => setPendingColor(color)}
                    aria-label={color}
                    aria-pressed={pendingColor === color}
                  />
                ))}
              </div>
              <div className="onboarding-custom-row" style={{ marginTop: 10 }}>
                <input
                  ref={customAreaRef}
                  type="text"
                  value={customAreaInput}
                  onChange={e => setCustomAreaInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomArea(); } }}
                  placeholder="Dodaj własny obszar..."
                  maxLength={40}
                />
                <button type="button" className="onboarding-add-btn" onClick={addCustomArea} aria-label="Dodaj obszar">+</button>
              </div>
            </div>
            <div className="onboarding-nav">
              <button className="onboarding-back" onClick={goBack} type="button">← Wróć</button>
              <div className="onboarding-nav-right">
                <button className="onboarding-skip-link" onClick={onSkip} type="button">Pomiń konfigurację</button>
                <button
                  className="onboarding-cta"
                  onClick={goNext}
                  type="button"
                  disabled={totalAreaCount === 0}
                >
                  Dalej →
                </button>
              </div>
            </div>
          </div>
        )}

        {step === 'contexts' && (
          <div className="onboarding-step">
            <div>
              <div className="onboarding-progress" aria-label={`Krok 3 z ${STEPS.length}`}>
                {STEPS.slice(1).map((s, i) => (
                  <div key={s} className={`onboarding-dot ${i === 1 ? 'active' : ''}`} title={STEP_LABELS[s]} />
                ))}
              </div>
            </div>
            <div>
              <div className="onboarding-title" id="onboarding-title">Konteksty zadań</div>
              <div className="onboarding-subtitle">Konteksty pomagają grupować zadania według miejsca lub narzędzia. Odznacz te, których nie potrzebujesz.</div>
            </div>
            <div className="context-chips" role="group" aria-label="Konteksty">
              {DEFAULT_CONTEXTS.map(ctx => {
                const isSelected = selectedContexts.has(ctx.name);
                return (
                  <button
                    key={ctx.name}
                    type="button"
                    className={`context-chip ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedContexts(prev => {
                      const next = new Set(prev);
                      if (next.has(ctx.name)) next.delete(ctx.name);
                      else next.add(ctx.name);
                      return next;
                    })}
                    aria-pressed={isSelected}
                  >
                    <span>{ctx.icon}</span>
                    {ctx.name}
                  </button>
                );
              })}
              {customContexts.map(ctx => (
                <button
                  key={ctx.name}
                  type="button"
                  className="context-chip selected"
                  onClick={() => removeCustomContext(ctx.name)}
                  aria-pressed={true}
                  title="Kliknij, aby usunąć"
                >
                  <span>{ctx.icon}</span>
                  {ctx.name} ×
                </button>
              ))}
            </div>
            <div className="onboarding-custom-row">
              <input
                ref={customContextRef}
                type="text"
                value={customContextInput}
                onChange={e => setCustomContextInput(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); addCustomContext(); } }}
                placeholder="Dodaj własny kontekst..."
                maxLength={30}
              />
              <select
                value={customContextIcon}
                onChange={e => setCustomContextIcon(e.target.value)}
                aria-label="Wybierz ikonę"
                style={{ width: 36, borderBottom: '1px solid var(--border)', padding: '4px 0 6px', background: 'transparent', border: 'none', fontSize: 16, cursor: 'pointer', outline: 'none' }}
              >
                {['📝', '🛒', '🔧', '📱', '🤝', '📚', '🏠', '🚗', '💡', '⚡', '🎯', '🌿'].map(e => (
                  <option key={e} value={e}>{e}</option>
                ))}
              </select>
              <button type="button" className="onboarding-add-btn" onClick={addCustomContext} aria-label="Dodaj kontekst">+</button>
            </div>
            <div className="onboarding-nav">
              <button className="onboarding-back" onClick={goBack} type="button">← Wróć</button>
              <div className="onboarding-nav-right">
                <button className="onboarding-skip-link" onClick={onSkip} type="button">Pomiń konfigurację</button>
                <button className="onboarding-cta" onClick={goNext} type="button">Dalej →</button>
              </div>
            </div>
          </div>
        )}

        {step === 'project' && (
          <div className="onboarding-step">
            <div>
              <div className="onboarding-progress" aria-label={`Krok 4 z ${STEPS.length}`}>
                {STEPS.slice(1).map((s, i) => (
                  <div key={s} className={`onboarding-dot ${i === 2 ? 'active' : ''}`} title={STEP_LABELS[s]} />
                ))}
              </div>
            </div>
            <div>
              <div className="onboarding-title" id="onboarding-title">Zacznij od jednego projektu</div>
              <div className="onboarding-subtitle">Projekt to konkretne przedsięwzięcie z planowanym końcem. Możesz pominąć ten krok.</div>
            </div>
            <div className="onboarding-field">
              <label htmlFor="ob-project-area">Obszar</label>
              <select
                id="ob-project-area"
                value={projectAreaName}
                onChange={e => setProjectAreaName(e.target.value)}
              >
                {getSelectedAreaObjects().map(a => (
                  <option key={a.name} value={a.name}>{a.name}</option>
                ))}
              </select>
            </div>
            <div className="onboarding-field">
              <label htmlFor="ob-project-name">Nazwa projektu</label>
              <input
                id="ob-project-name"
                type="text"
                value={projectName}
                onChange={e => setProjectName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleComplete(); } }}
                placeholder="np. Remont łazienki, Prezentacja Q3"
                maxLength={80}
                autoFocus
              />
            </div>
            <div className="onboarding-nav">
              <button className="onboarding-back" onClick={goBack} type="button">← Wróć</button>
              <div className="onboarding-nav-right">
                <button
                  className="onboarding-skip-link"
                  onClick={handleComplete}
                  type="button"
                >
                  Pomiń ten krok
                </button>
                <button
                  className="onboarding-cta"
                  onClick={handleComplete}
                  type="button"
                  disabled={!projectName.trim()}
                >
                  Gotowe →
                </button>
              </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}

// ── Spotlight Tour ────────────────────────────────────────

interface TourStep {
  selector: string;
  text: string;
}

const TOUR_STEPS: TourStep[] = [
  { selector: '[data-tour="inbox"]', text: 'Zadania bez projektu lądują tutaj. Dobry punkt startowy.' },
  { selector: '[data-tour="today"]', text: 'Tu planujesz swój dzień — bloki czasowe i wydarzenia.' },
  { selector: '[data-tour="plan"]', text: 'Tu organizujesz obszary, projekty i zadania.' },
];

interface SpotlightProps {
  onDone: () => void;
}

export function SpotlightTour({ onDone }: SpotlightProps) {
  const [stepIndex, setStepIndex] = useState(0);
  const [tooltipStyle, setTooltipStyle] = useState<React.CSSProperties>({});

  const currentStep = TOUR_STEPS[stepIndex];

  useEffect(() => {
    const el = document.querySelector(currentStep.selector);
    if (!el) return;

    el.setAttribute('data-tour-highlight', 'true');
    const rect = el.getBoundingClientRect();
    setTooltipStyle({
      top: rect.bottom + 10,
      left: Math.min(rect.left, window.innerWidth - 240),
    });

    return () => {
      el.removeAttribute('data-tour-highlight');
    };
  }, [stepIndex, currentStep.selector]);

  const handleNext = () => {
    if (stepIndex < TOUR_STEPS.length - 1) {
      setStepIndex(prev => prev + 1);
    } else {
      onDone();
    }
  };

  const isLast = stepIndex === TOUR_STEPS.length - 1;

  return (
    <div className="tour-overlay" aria-live="polite">
      <div className="tour-tooltip" style={tooltipStyle} role="tooltip">
        <div className="tour-tooltip-text">{currentStep.text}</div>
        <div className="tour-tooltip-nav">
          <button className="tour-close" onClick={onDone} type="button">Pomiń tour</button>
          <button className="tour-next" onClick={handleNext} type="button">
            {isLast ? 'Rozumiem ✓' : 'Dalej →'}
          </button>
        </div>
      </div>
    </div>
  );
}
