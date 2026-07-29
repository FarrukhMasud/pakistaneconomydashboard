import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'pak-eco-watchlist-v1';
const listeners = new Set();

function readPins() {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed.filter((id) => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

let cachedPins = readPins();

function emit() {
  listeners.forEach((fn) => fn());
}

function writePins(next) {
  cachedPins = [...next];
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedPins));
  } catch {
    /* private mode / quota — keep in-memory only */
  }
  emit();
}

function subscribe(listener) {
  listeners.add(listener);
  const onStorage = (event) => {
    if (event.key === STORAGE_KEY || event.key === null) {
      cachedPins = readPins();
      listener();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('storage', onStorage);
  };
}

function getSnapshot() {
  return cachedPins;
}

function getServerSnapshot() {
  return [];
}

/**
 * Persistent indicator watchlist (localStorage).
 * Pin IDs match kpi-summary indicator ids or indicator catalog ids.
 */
export function useWatchlist() {
  const pins = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const isPinned = useCallback((id) => pins.includes(id), [pins]);

  const toggle = useCallback((id) => {
    if (!id) return;
    const next = pins.includes(id)
      ? pins.filter((item) => item !== id)
      : [...pins, id];
    writePins(next);
  }, [pins]);

  const pin = useCallback((id) => {
    if (!id || pins.includes(id)) return;
    writePins([...pins, id]);
  }, [pins]);

  const unpin = useCallback((id) => {
    if (!id || !pins.includes(id)) return;
    writePins(pins.filter((item) => item !== id));
  }, [pins]);

  const clear = useCallback(() => writePins([]), []);

  return { pins, isPinned, toggle, pin, unpin, clear };
}

/** Imperative helpers for non-hook call sites */
export const watchlistApi = {
  get: () => getSnapshot(),
  toggle: (id) => {
    const pins = getSnapshot();
    writePins(pins.includes(id) ? pins.filter((x) => x !== id) : [...pins, id]);
  },
};
