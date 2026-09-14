import { normalizePinId, normalizePins } from './watchlistModel.js';

export const WATCHLIST_STORAGE_KEY = 'pak-eco-watchlist-v1';

export function createWatchlistStore(getStorage) {
  const listeners = new Set();
  let serial = 0;
  let state = { pins: [], action: null, error: null };
  const emit = () => listeners.forEach((listener) => listener());
  function read() {
    try {
      const raw = getStorage()?.getItem(WATCHLIST_STORAGE_KEY);
      const pins = raw ? JSON.parse(raw) : [];
      if (!Array.isArray(pins)) throw new Error('Invalid saved watchlist');
      state = { pins: normalizePins(pins), action: null, error: null };
    } catch (error) {
      console.warn('Could not read saved watchlist:', error);
      state = { ...state, action: null, error: 'read' };
    }
  }
  read();

  function write(pins, action) {
    let error = null;
    try {
      getStorage()?.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(pins));
    } catch (cause) {
      console.warn('Could not save watchlist:', cause);
      error = 'write';
    }
    state = { pins, action, error };
    emit();
  }

  function setPin(rawId, pinned) {
    if (typeof rawId !== 'string' || !rawId.trim()) throw new Error('A watchlist indicator ID is required');
    const id = normalizePinId(rawId);
    if (state.pins.includes(id) === pinned) return;
    write(pinned ? [...state.pins, id] : state.pins.filter((item) => item !== id), {
      token: ++serial, kind: pinned ? 'pin' : 'unpin', ids: [id],
    });
  }

  return {
    getSnapshot: () => state,
    subscribe: (listener) => { listeners.add(listener); return () => listeners.delete(listener); },
    reload: () => { read(); emit(); },
    toggle: (id) => setPin(id, !state.pins.includes(normalizePinId(id))),
    pin: (id) => setPin(id, true),
    unpin: (id) => setPin(id, false),
    clear: () => {
      if (state.pins.length) write([], { token: ++serial, kind: 'clear', ids: [...state.pins] });
    },
    dismiss: (token) => {
      if (state.action?.token !== token) return;
      state = { ...state, action: null };
      emit();
    },
    undo: (token) => {
      const action = state.action;
      // A detached/old Undo button must not replace a newer action or tab's pins.
      if (!action || action.token !== token || action.kind === 'undo') return;
      const pins = action.kind === 'pin'
        ? state.pins.filter((id) => !action.ids.includes(id))
        : normalizePins([...state.pins, ...action.ids]);
      write(pins, { token: ++serial, kind: 'undo', ids: action.ids });
    },
  };
}
