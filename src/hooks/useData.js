import { useCallback, useEffect, useSyncExternalStore } from 'react';
import {
  getDataSnapshot,
  loadData,
  retryData,
  subscribeData,
} from './dataCache';

/**
 * Shared data hook for /data/*.json files.
 * Dedupes fetches, supports retry, and uses build-time cache busting.
 *
 * Uses useSyncExternalStore with a cached snapshot reference per cache entry
 * (see dataCache.getDataSnapshot) so React does not infinite-loop on identity churn.
 */
export function useData(filename) {
  const getSnapshot = useCallback(() => getDataSnapshot(filename), [filename]);
  const subscribe = useCallback(
    (onStoreChange) => subscribeData(filename, onStoreChange),
    [filename],
  );

  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    loadData(filename);
  }, [filename]);

  const retry = useCallback(() => {
    retryData(filename);
  }, [filename]);

  return { ...state, retry };
}

/**
 * Imperative multi-file loader for export packs etc.
 */
export async function loadMany(filenames) {
  const results = await Promise.all(filenames.map((f) => loadData(f)));
  const out = {};
  filenames.forEach((f, i) => {
    out[f] = results[i];
  });
  return out;
}
