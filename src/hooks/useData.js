import { useCallback, useEffect, useMemo, useSyncExternalStore } from 'react';
import { DATASET_INPUTS, freshnessWithCanonical, prepareDataset } from '../utils/figureTrust';
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
  const meta = useSyncExternalStore(
    subscribeFreshness, getFreshnessSnapshot, getFreshnessSnapshot,
  );
  const inputIds = DATASET_INPUTS[filename.replace(/\.json$/, '')] || NO_IDS;
  const subscribeInputs = useCallback((listener) => subscribeSources(inputIds, listener), [inputIds]);
  const inputSnapshot = useCallback(() => sourceSnapshot(inputIds), [inputIds]);
  const inputs = useSyncExternalStore(subscribeInputs, inputSnapshot, inputSnapshot);
  const isMetadata = ['data-freshness.json', 'provenance.json', 'editorial-notes.json', 'update-preview.json'].includes(filename);
  const prepared = useMemo(() => isMetadata
    ? { data: state.data, unavailable: null, publication: null }
    : prepareDataset(state.data, meta.data?.datasets?.find((item) => item.id === filename.replace(/\.json$/, '')), meta.data, filename.replace(/\.json$/, ''), inputs),
  [state.data, meta.data, filename, isMetadata, inputs]);

  useEffect(() => {
    loadData(filename);
    if (!isMetadata) loadData('data-freshness.json');
    inputIds.forEach((id) => loadData(`${id}.json`));
  }, [filename, isMetadata, inputIds]);

  const retry = useCallback(() => {
    retryData(filename);
    if (!isMetadata && meta.error) retryData('data-freshness.json');
    Object.entries(inputs).filter(([, result]) => result.error).forEach(([id]) => retryData(`${id}.json`));
  }, [filename, isMetadata, meta.error, inputs]);

  return {
    ...state, ...prepared, rawData: state.data, retry,
    error: state.error || (!isMetadata ? meta.error : null),
    data: !isMetadata && meta.error ? null : prepared.data,
    dependencyErrors: Object.entries(inputs).filter(([, result]) => result.error).map(([id, result]) => ({ id, error: result.error })),
    loading: state.loading || (!isMetadata && meta.loading) || (!prepared.unavailable && Object.values(inputs).some((result) => result.loading)),
  };
}

const subscribeFreshness = (listener) => subscribeData('data-freshness.json', listener);
const getFreshnessSnapshot = () => getDataSnapshot('data-freshness.json');
const NO_IDS = Object.freeze([]);
const NO_INPUTS = Object.freeze({});
function subscribeSources(ids, listener) {
  const unsubscribe = ids.map((id) => subscribeData(`${id}.json`, listener));
  return () => unsubscribe.forEach((off) => off());
}

const policySnapshots = new Map();
function sourceSnapshot(ids) {
  const key = ids.join(',');
  const previous = policySnapshots.get(key) || NO_INPUTS;
  const next = Object.fromEntries(ids.map((id) => [id, getDataSnapshot(`${id}.json`)]));
  if (ids.every((id) => previous[id] === next[id])) return previous;
  policySnapshots.set(key, next);
  return next;
}
export function useSourcePolicies(datasetIds = []) {
  const key = [...new Set(datasetIds.filter((id) => typeof id === 'string' && /^[a-z0-9-]+$/.test(id)))].sort().join(',');
  const ids = useMemo(() => key ? key.split(',') : [], [key]);
  const subscribe = useCallback((listener) => subscribeSources(ids, listener), [ids]);
  const snapshot = useCallback(() => sourceSnapshot(ids), [ids]);
  const sources = useSyncExternalStore(subscribe, snapshot, snapshot);
  const meta = useSyncExternalStore(subscribeFreshness, getFreshnessSnapshot, getFreshnessSnapshot);
  const data = useMemo(() => freshnessWithCanonical(meta.data, sources), [meta.data, sources]);
  useEffect(() => {
    loadData('data-freshness.json');
    ids.forEach((id) => loadData(`${id}.json`));
  }, [ids]);
  const retry = useCallback(() => {
    if (meta.error) retryData('data-freshness.json');
    ids.filter((id) => sources[id]?.error).forEach((id) => retryData(`${id}.json`));
  }, [ids, sources, meta.error]);
  return {
    data, error: meta.error, retry,
    loading: meta.loading || Object.values(sources).some((result) => result.loading),
    dependencyErrors: Object.entries(sources).filter(([, result]) => result.error).map(([id, result]) => ({ id, error: result.error })),
  };
}

/**
 * Imperative multi-file loader for export packs etc.
 */
export async function loadMany(filenames) {
  const [metadata, ...results] = await Promise.all([loadData('data-freshness.json'), ...filenames.map((f) => loadData(f))]);
  if (metadata.error) throw metadata.error;
  const inputIds = [...new Set(filenames.flatMap((name) => DATASET_INPUTS[name.replace(/\.json$/, '')] || []))];
  const sources = await Promise.all(inputIds.map(async (id) => [id, await loadData(`${id}.json`)]));
  const failedSource = sources.find(([, result]) => result.error);
  if (failedSource) throw failedSource[1].error;
  const canonicalSources = Object.fromEntries(sources);
  const requestedSources = Object.fromEntries(filenames.flatMap((name, index) =>
    ['data-freshness.json', 'provenance.json'].includes(name) ? [] : [[name.replace(/\.json$/, ''), results[index]]]));
  const effectiveFreshness = freshnessWithCanonical(metadata.data, { ...requestedSources, ...canonicalSources });
  const out = {};
  filenames.forEach((f, i) => {
    const result = results[i];
    if (result.error) throw result.error;
    out[f] = f === 'data-freshness.json' ? { ...result, data: effectiveFreshness } : f === 'provenance.json' ? result : {
      ...result, ...prepareDataset(result.data, metadata.data?.datasets?.find((item) => item.id === f.replace(/\.json$/, '')), metadata.data, f.replace(/\.json$/, ''), canonicalSources),
    };
  });
  return out;
}
