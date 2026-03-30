import { useState, useRef, useCallback, useEffect } from 'react';

export type SoundId = 'white-noise' | 'pink-noise' | 'brown-noise' | 'rain' | 'forest';
type SoundType = 'generated' | 'file';

export const SOUNDS: { id: SoundId; label: string; type: SoundType }[] = [
  { id: 'white-noise', label: 'Szum biały', type: 'generated' },
  { id: 'pink-noise',  label: 'Szum różowy', type: 'generated' },
  { id: 'brown-noise', label: 'Szum brązowy', type: 'generated' },
  { id: 'rain',        label: 'Deszcz', type: 'file' },
  { id: 'forest',      label: 'Las', type: 'file' },
];

const LS_SOUND_ID = 'dopadone-ambient-sound-id';
const LS_VOLUME   = 'dopadone-ambient-volume';
const SAMPLE_RATE = 44100;
const BUFFER_SECS = 10;

function generateNoiseBuffer(ctx: AudioContext, type: 'white-noise' | 'pink-noise' | 'brown-noise'): AudioBuffer {
  const length = SAMPLE_RATE * BUFFER_SECS;
  const buffer = ctx.createBuffer(1, length, SAMPLE_RATE);
  const data = buffer.getChannelData(0);

  if (type === 'white-noise') {
    for (let i = 0; i < length; i++) {
      data[i] = Math.random() * 2 - 1;
    }
  } else if (type === 'pink-noise') {
    // Paul Kellet's pink noise approximation
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      const pink = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
      b6 = white * 0.115926;
      data[i] = Math.max(-1, Math.min(1, pink * 0.11));
    }
  } else {
    // Brown noise: one-pole integrator
    let lastOut = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      lastOut = (lastOut + 0.02 * white) / 1.02;
      data[i] = Math.max(-1, Math.min(1, lastOut * 3.5));
    }
  }

  return buffer;
}

export function useAmbientSound() {
  const [activeSoundId, setActiveSoundId] = useState<SoundId | null>(() => {
    const stored = localStorage.getItem(LS_SOUND_ID);
    return (stored as SoundId) ?? null;
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const [volume, setVolumeState] = useState<number>(() => {
    const stored = localStorage.getItem(LS_VOLUME);
    return stored != null ? parseFloat(stored) : 0.4;
  });

  // Web Audio API refs
  const audioCtxRef   = useRef<AudioContext | null>(null);
  const gainNodeRef   = useRef<GainNode | null>(null);
  const noiseSourceRef = useRef<AudioBufferSourceNode | null>(null);

  // HTMLAudioElement ref (file-based sounds)
  const audioElRef = useRef<HTMLAudioElement | null>(null);

  const stopAll = useCallback(() => {
    // Stop generated noise
    if (noiseSourceRef.current) {
      try { noiseSourceRef.current.stop(); } catch {}
      noiseSourceRef.current = null;
    }
    // Stop file audio
    if (audioElRef.current) {
      audioElRef.current.pause();
      audioElRef.current.currentTime = 0;
    }
    setIsPlaying(false);
  }, []);

  const playGenerated = useCallback((soundId: 'white-noise' | 'pink-noise' | 'brown-noise', vol: number) => {
    // Create AudioContext on first use (must be inside user gesture)
    if (!audioCtxRef.current) {
      audioCtxRef.current = new AudioContext();
      const gainNode = audioCtxRef.current.createGain();
      gainNode.gain.value = vol;
      gainNode.connect(audioCtxRef.current.destination);
      gainNodeRef.current = gainNode;
    }

    const ctx = audioCtxRef.current;
    if (ctx.state === 'suspended') ctx.resume();

    const buffer = generateNoiseBuffer(ctx, soundId);
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    source.loop = true;
    source.connect(gainNodeRef.current!);
    source.start();

    noiseSourceRef.current = source;
    setIsPlaying(true);
  }, []);

  const playFile = useCallback((soundId: 'rain' | 'forest', vol: number) => {
    const base = import.meta.env.BASE_URL.replace(/\/$/, '');
    const src = `${base}/sounds/${soundId}.mp3`;

    if (!audioElRef.current || audioElRef.current.src !== new URL(src, location.href).href) {
      if (audioElRef.current) {
        audioElRef.current.pause();
      }
      audioElRef.current = new Audio(src);
      audioElRef.current.loop = true;
    }

    audioElRef.current.volume = vol;
    audioElRef.current.play().then(() => {
      setIsPlaying(true);
    }).catch(() => {
      // Autoplay blocked
    });
  }, []);

  const selectSound = useCallback((id: SoundId) => {
    const sound = SOUNDS.find(s => s.id === id);
    if (!sound) return;

    // Same sound clicked → toggle
    if (id === activeSoundId) {
      if (isPlaying) {
        stopAll();
      } else {
        setActiveSoundId(id);
        if (sound.type === 'generated') {
          playGenerated(id as 'white-noise' | 'pink-noise' | 'brown-noise', volume);
        } else {
          playFile(id as 'rain' | 'forest', volume);
        }
      }
      return;
    }

    // Different sound → stop current, start new
    stopAll();
    setActiveSoundId(id);

    if (sound.type === 'generated') {
      playGenerated(id as 'white-noise' | 'pink-noise' | 'brown-noise', volume);
    } else {
      playFile(id as 'rain' | 'forest', volume);
    }
  }, [activeSoundId, isPlaying, volume, stopAll, playGenerated, playFile]);

  const setVolume = useCallback((v: number) => {
    setVolumeState(v);
    // Apply immediately
    if (gainNodeRef.current) {
      gainNodeRef.current.gain.value = v;
    }
    if (audioElRef.current) {
      audioElRef.current.volume = v;
    }
  }, []);

  const stop = useCallback(() => {
    stopAll();
  }, [stopAll]);

  // Persist activeSoundId and volume
  useEffect(() => {
    if (activeSoundId) {
      localStorage.setItem(LS_SOUND_ID, activeSoundId);
    } else {
      localStorage.removeItem(LS_SOUND_ID);
    }
  }, [activeSoundId]);

  useEffect(() => {
    localStorage.setItem(LS_VOLUME, String(volume));
  }, [volume]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopAll();
      audioCtxRef.current?.close();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return { activeSoundId, isPlaying, volume, selectSound, setVolume, stop };
}
