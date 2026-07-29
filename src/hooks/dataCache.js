/**
 * Shared in-memory cache for static JSON under /data/*.
 * Dedupes in-flight requests across components (CiteFigure, EditorialNote, sections).
 *
 * Each entry carries a stable `ui` snapshot object for useSyncExternalStore.
 * React requires getSnapshot to return the same reference when nothing changed.
 */

const entries = new Map();
const listeners = new Map();

/** Shared placeholder before the first load starts. */
export const EMPTY_UI = Object.freeze({ data: null, loading: true, error: null });

function getVersion() {
  return import.meta.env?.VITE_DATA_VERSION || 'dev';
}

function makeUi(entry) {
  return {
    data: entry.data,
    loading: Boolean(entry.loading || entry.promise),
    error: entry.error,
  };
}

function setEntry(filename, entry) {
  entry.ui = makeUi(entry);
  entries.set(filename, entry);
  return entry;
}

function notify(filename) {
  const set = listeners.get(filename);
  if (!set) return;
  const entry = entries.get(filename);
  for (const fn of set) fn(entry);
}

export function subscribeData(filename, listener) {
  if (!listeners.has(filename)) listeners.set(filename, new Set());
  listeners.get(filename).add(listener);
  return () => {
    const set = listeners.get(filename);
    if (!set) return;
    set.delete(listener);
    if (set.size === 0) listeners.delete(filename);
  };
}

export function getCachedData(filename) {
  return entries.get(filename) || null;
}

/** Stable UI snapshot for useSyncExternalStore.getSnapshot. */
export function getDataSnapshot(filename) {
  return entries.get(filename)?.ui ?? EMPTY_UI;
}

export function peekData(filename) {
  return entries.get(filename)?.data ?? null;
}

/**
 * Load (or return cached) JSON. Concurrent callers share one fetch.
 * @returns {Promise<{ data: any, error: Error|null }>}
 */
export function loadData(filename, { force = false } = {}) {
  const existing = entries.get(filename);
  if (!force && existing?.data != null && !existing.error) {
    return Promise.resolve({ data: existing.data, error: null });
  }
  if (!force && existing?.promise) {
    return existing.promise;
  }

  const controller = new AbortController();
  const version = getVersion();
  const url = `/data/${filename}?v=${encodeURIComponent(version)}`;

  const entry = {
    data: force ? null : existing?.data ?? null,
    error: null,
    loading: true,
    promise: null,
    controller,
    updatedAt: existing?.updatedAt ?? null,
  };

  const promise = fetch(url, {
    // Version query already busts cache when data/deploy changes.
    cache: version === 'dev' ? 'no-store' : 'default',
    signal: controller.signal,
  })
    .then(async (res) => {
      if (!res.ok) throw new Error(`Failed to load ${filename}: ${res.status}`);
      return res.json();
    })
    .then((json) => {
      const current = entries.get(filename);
      // Ignore stale responses if a newer load replaced this entry.
      if (current?.promise !== promise) return { data: current?.data ?? json, error: null };
      setEntry(filename, {
        data: json,
        error: null,
        loading: false,
        promise: null,
        controller: null,
        updatedAt: Date.now(),
      });
      notify(filename);
      return { data: json, error: null };
    })
    .catch((err) => {
      if (err?.name === 'AbortError') {
        return { data: entries.get(filename)?.data ?? null, error: null };
      }
      const current = entries.get(filename);
      if (current?.promise !== promise) {
        return { data: current?.data ?? null, error: current?.error ?? err };
      }
      const next = setEntry(filename, {
        data: current?.data ?? null,
        error: err,
        loading: false,
        promise: null,
        controller: null,
        updatedAt: current?.updatedAt ?? null,
      });
      notify(filename);
      return { data: next.data, error: err };
    });

  entry.promise = promise;
  setEntry(filename, entry);
  notify(filename);
  return promise;
}

export function retryData(filename) {
  const existing = entries.get(filename);
  existing?.controller?.abort();
  return loadData(filename, { force: true });
}

/** Test helper — clears all cached entries. */
export function __resetDataCache() {
  for (const entry of entries.values()) {
    entry.controller?.abort();
  }
  entries.clear();
  listeners.clear();
}
