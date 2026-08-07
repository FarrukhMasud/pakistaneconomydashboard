import { useCallback, useSyncExternalStore } from 'react';

const STORAGE_KEY = 'pak-eco-density';
const listeners = new Set();

function readDensity() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'compact' || stored === 'comfortable') return stored;
  } catch {
    /* ignore */
  }
  return 'compact';
}

let density = typeof window !== 'undefined' ? readDensity() : 'compact';

function emit() {
  listeners.forEach((listener) => listener());
}

function applyDensity(next) {
  density = next;
  try {
    localStorage.setItem(STORAGE_KEY, next);
  } catch {
    /* ignore */
  }
  if (typeof document !== 'undefined') {
    document.documentElement.dataset.density = next;
  }
  emit();
}

if (typeof document !== 'undefined') {
  document.documentElement.dataset.density = density;
}

function subscribe(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function getSnapshot() {
  return density;
}

function getServerSnapshot() {
  return 'compact';
}

/**
 * Brief vs analyst detail mode (persisted using the legacy density values).
 */
export function useDensity() {
  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setDensity = useCallback((next) => {
    if (next !== 'compact' && next !== 'comfortable') return;
    if (next === density) return;
    applyDensity(next);
  }, []);

  const toggle = useCallback(() => {
    applyDensity(density === 'compact' ? 'comfortable' : 'compact');
  }, []);

  return { density: value, setDensity, toggle };
}

export default useDensity;
