import { useCallback, useSyncExternalStore } from 'react';
import { normalizePinId } from '../utils/watchlistModel.js';
import { createWatchlistStore, WATCHLIST_STORAGE_KEY } from '../utils/watchlistStore.js';

const store = createWatchlistStore(() => typeof window === 'undefined' ? null : window.localStorage);
const serverSnapshot = { pins: [], action: null, error: null };
const getServerSnapshot = () => serverSnapshot;

function subscribe(listener) {
  const unsubscribe = store.subscribe(listener);
  const onStorage = (event) => {
    if (event.key === WATCHLIST_STORAGE_KEY || event.key === null) {
      store.reload();
    }
  };
  window.addEventListener('storage', onStorage);
  return () => {
    unsubscribe();
    window.removeEventListener('storage', onStorage);
  };
}

/**
 * Persistent indicator watchlist (localStorage).
 * Pin IDs match kpi-summary indicator ids or indicator catalog ids.
 */
export function useWatchlist() {
  const state = useSyncExternalStore(subscribe, store.getSnapshot, getServerSnapshot);
  const isPinned = useCallback((id) => state.pins.includes(normalizePinId(id)), [state.pins]);
  return { ...state, isPinned, toggle: store.toggle, pin: store.pin, unpin: store.unpin, clear: store.clear, undo: store.undo, dismiss: store.dismiss };
}

/** Imperative helpers for non-hook call sites */
export const watchlistApi = {
  get: () => store.getSnapshot().pins,
  toggle: store.toggle,
};
