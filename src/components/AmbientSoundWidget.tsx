import React, { useState, useRef, useEffect } from 'react';
import { useAmbientSound, SOUNDS } from '../hooks/useAmbientSound';
import './AmbientSoundWidget.css';

export function AmbientSoundWidget() {
  const [open, setOpen] = useState(false);
  const { activeSoundId, isPlaying, volume, selectSound, setVolume, stop } = useAmbientSound();
  const panelRef = useRef<HTMLDivElement>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  // Close on click outside
  useEffect(() => {
    if (!open) return;
    function onMouseDown(e: MouseEvent) {
      if (
        panelRef.current && !panelRef.current.contains(e.target as Node) &&
        btnRef.current && !btnRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', onMouseDown);
    return () => document.removeEventListener('mousedown', onMouseDown);
  }, [open]);

  return (
    <div className="ambient-widget">
      <button
        ref={btnRef}
        className={`ambient-btn${isPlaying ? ' ambient-btn--playing' : ''}`}
        onClick={() => setOpen(o => !o)}
        aria-label="Dźwięki skupienia"
        aria-expanded={open}
        aria-haspopup="true"
        title="Dźwięki skupienia"
      >
        <span className="ambient-btn-icon">♪</span>
        <span className="ambient-btn-label">Dźwięki</span>
      </button>

      {open && (
        <div className="ambient-panel" ref={panelRef} role="dialog" aria-label="Dźwięki skupienia">
          <div className="ambient-sound-list">
            {SOUNDS.map(sound => (
              <button
                key={sound.id}
                className={`ambient-sound-btn${activeSoundId === sound.id && isPlaying ? ' ambient-sound-btn--active' : ''}`}
                onClick={() => selectSound(sound.id)}
              >
                <span className="ambient-sound-indicator" />
                {sound.label}
              </button>
            ))}
          </div>

          <div className="ambient-volume">
            <span className="ambient-volume-label">Głośność</span>
            <input
              type="range"
              className="ambient-volume-slider"
              min={0}
              max={1}
              step={0.01}
              value={volume}
              onChange={e => setVolume(Number(e.target.value))}
              aria-label="Głośność"
            />
          </div>

          {isPlaying && (
            <button className="ambient-stop-btn" onClick={() => { stop(); }}>
              Zatrzymaj
            </button>
          )}
        </div>
      )}
    </div>
  );
}
