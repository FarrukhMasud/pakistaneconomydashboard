import { useCallback, useEffect, useState } from 'react';

export function parseShareableChartState(search, defaultCompare = 'off') {
  const params = new URLSearchParams(search);
  const compare = ['off', 'yoy', 'fytd'].includes(params.get('compare'))
    ? params.get('compare')
    : defaultCompare;
  const rawFocus = params.get('series');
  const parsedFocus = rawFocus == null ? null : Number(rawFocus);
  return {
    compare,
    focus: Number.isInteger(parsedFocus) && parsedFocus >= 0 ? parsedFocus : null,
  };
}

export function applyShareableChartState(search, { compare, focus }, defaultCompare = 'off') {
  const params = new URLSearchParams(search);
  if (compare === defaultCompare) params.delete('compare');
  else params.set('compare', compare);
  if (focus == null) params.delete('series');
  else params.set('series', String(focus));
  const value = params.toString();
  return value ? `?${value}` : '';
}

function readState(defaultCompare) {
  if (typeof window === 'undefined') return { compare: defaultCompare, focus: null };
  return parseShareableChartState(window.location.search, defaultCompare);
}

function writeState(state, defaultCompare) {
  const url = new URL(window.location.href);
  const search = applyShareableChartState(url.search, state, defaultCompare);
  window.history.replaceState(null, '', `${url.pathname}${search}${url.hash}`);
}

export function useShareableChartState(defaultCompare = 'off') {
  const [state, setState] = useState(() => readState(defaultCompare));

  useEffect(() => {
    const sync = () => setState(readState(defaultCompare));
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, [defaultCompare]);

  const setCompare = useCallback((compare) => {
    setState(() => {
      const next = { compare, focus: null };
      writeState(next, defaultCompare);
      return next;
    });
  }, [defaultCompare]);

  const setFocus = useCallback((focus) => {
    setState((current) => {
      const next = { ...current, focus };
      writeState(next, defaultCompare);
      return next;
    });
  }, [defaultCompare]);

  return {
    compareMode: state.compare,
    focus: state.focus,
    setCompareMode: setCompare,
    setFocus,
  };
}

export default useShareableChartState;
