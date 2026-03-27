import { useState, useEffect, useRef } from 'react';

const VERSION_URL = '/dopadone-web/version.json';
const POLL_INTERVAL = 5 * 60 * 1000;

async function fetchBuildTime(): Promise<string | null> {
  try {
    const res = await fetch(`${VERSION_URL}?t=${Date.now()}`, { cache: 'no-store' });
    if (!res.ok) return null;
    const data = await res.json();
    return data.buildTime ?? null;
  } catch {
    return null;
  }
}

export function useVersionCheck(): { updateAvailable: boolean } {
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const initialBuildTime = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function check() {
      const buildTime = await fetchBuildTime();
      if (cancelled) return;
      if (buildTime === null) return;

      if (initialBuildTime.current === null) {
        initialBuildTime.current = buildTime;
      } else if (buildTime !== initialBuildTime.current) {
        setUpdateAvailable(true);
      }
    }

    check();

    const interval = setInterval(check, POLL_INTERVAL);

    function handleVisibilityChange() {
      if (document.visibilityState === 'visible') {
        check();
      }
    }
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      cancelled = true;
      clearInterval(interval);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []);

  return { updateAvailable };
}
