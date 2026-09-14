import { useCallback, useEffect, useState } from 'react';
import { normalizeChartRange } from '../utils/chartTimeRange.js';

const CHART_STATE_EVENT = 'chart-state-change';
const COMPARE_MODES = ['off', 'yoy', 'fytd'];

export function shareableChartSearch(locationLike) {
  const params = new URLSearchParams(locationLike?.search || '');
  const hash = String(locationLike?.hash || '');
  if (/^#\/|^#[^/]+\/[^/]+/.test(hash) && hash.includes('?')) {
    new URLSearchParams(hash.slice(hash.indexOf('?'))).forEach((value, key) => params.set(key, value));
  }
  return params.toString();
}

export function parseShareableChartState(search, defaultCompare = 'off', defaultRange = 'all') {
  const params = new URLSearchParams(search);
  const compare = COMPARE_MODES.includes(params.get('compare'))
    ? params.get('compare')
    : defaultCompare;
  const rawFocus = params.get('series');
  const parsedFocus = rawFocus != null && /^\d+$/.test(rawFocus) ? Number(rawFocus) : null;
  return {
    compare,
    focus: Number.isSafeInteger(parsedFocus) && parsedFocus >= 0 ? parsedFocus : null,
    range: normalizeChartRange(params.get('range'), defaultRange),
  };
}

export function applyShareableChartState(search, patch, defaultCompare = 'off', defaultRange = 'all') {
  const params = new URLSearchParams(search);
  if ('compare' in patch) {
    if (!COMPARE_MODES.includes(patch.compare) || patch.compare === defaultCompare) params.delete('compare');
    else params.set('compare', patch.compare);
  }
  if ('focus' in patch) {
    if (!Number.isSafeInteger(patch.focus) || patch.focus < 0) params.delete('series');
    else params.set('series', String(patch.focus));
  }
  if ('range' in patch) {
    const range = normalizeChartRange(patch.range, defaultRange);
    // Keep an explicit selection, including All, because charts can have
    // different sensible defaults before the reader chooses a shared range.
    params.set('range', range);
  }
  const value = params.toString();
  return value ? `?${value}` : '';
}

function readState(defaultCompare, defaultRange) {
  return parseShareableChartState(typeof window === 'undefined' ? '' : shareableChartSearch(window.location), defaultCompare, defaultRange);
}

function writeState(patch, defaultCompare, defaultRange) {
  const url = new URL(window.location.href);
  const search = applyShareableChartState(url.search, patch, defaultCompare, defaultRange);
  if (search !== url.search) {
    window.history.pushState(window.history.state, '', `${url.pathname}${search}${url.hash}`);
    window.dispatchEvent(new Event(CHART_STATE_EVENT));
  }
}

export function useShareableChartState(defaultCompare = 'off', defaultRange = 'all') {
  const [state, setState] = useState(() => readState(defaultCompare, defaultRange));

  useEffect(() => {
    const sync = () => setState(readState(defaultCompare, defaultRange));
    window.addEventListener('popstate', sync);
    window.addEventListener('hashchange', sync);
    window.addEventListener(CHART_STATE_EVENT, sync);
    return () => {
      window.removeEventListener('popstate', sync);
      window.removeEventListener('hashchange', sync);
      window.removeEventListener(CHART_STATE_EVENT, sync);
    };
  }, [defaultCompare, defaultRange]);

  const setCompare = useCallback((compare) => {
    writeState({ compare }, defaultCompare, defaultRange);
  }, [defaultCompare, defaultRange]);

  const setFocus = useCallback((focus) => {
    writeState({ focus }, defaultCompare, defaultRange);
  }, [defaultCompare, defaultRange]);

  const setRange = useCallback((range) => {
    writeState({ range }, defaultCompare, defaultRange);
  }, [defaultCompare, defaultRange]);

  return {
    compareMode: state.compare,
    focus: state.focus,
    range: state.range,
    setCompareMode: setCompare,
    setFocus,
    setRange,
  };
}

export default useShareableChartState;
