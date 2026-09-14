import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

function isRouteHash(hash) {
  return /^#\/|^#[^/]+\/[^/]+/.test(hash);
}

export function readChartTarget(locationLike) {
  const hash = String(locationLike?.hash || '');
  const search = isRouteHash(hash) && hash.includes('?')
    ? hash.slice(hash.indexOf('?')) : locationLike?.search;
  const value = new URLSearchParams(search || '').get('chart');
  return /^chart-[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value || '') ? value : null;
}

/**
 * Parses path or hash routes into a validated { groupId, sectionId, known }.
 * Supports:
 *   #/group/section  (legacy + share links)
 *   /group/section   (path-based SEO-friendly URLs)
 *
 * Unknown paths keep known=false so the shell can show a not-found state
 * without silently rewriting the URL to overview.
 */
export function parseRoute(locationLike, groups) {
  const hash = String(locationLike?.hash || '');
  const pathname = String(locationLike?.pathname || '/');
  const fallback = {
    groupId: groups[0].id,
    sectionId: groups[0].sections[0].id,
    known: true,
    assetLike: false,
  };

  let raw = '';
  if (isRouteHash(hash) && hash !== '#/') {
    raw = hash.replace(/^#\/?/, '').split('?')[0];
  } else {
    raw = pathname.replace(/^\//, '');
  }

  const parts = raw
    .split('/')
    .map((part) => {
      try {
        return decodeURIComponent(part.trim());
      } catch {
        return part.trim();
      }
    })
    .filter(Boolean);

  // Root / empty → default overview (known).
  if (!parts.length) {
    return fallback;
  }

  // Asset-like first segments are not app routes; leave URL alone.
  if (parts[0] === 'assets' || parts[0] === 'data' || parts[0] === 'api') {
    return { ...fallback, known: false, assetLike: true };
  }

  const group = groups.find((g) => g.id === parts[0]);
  if (!group) {
    return { ...fallback, known: false, assetLike: false };
  }

  if (parts.length > 2) {
    return { ...fallback, groupId: group.id, sectionId: group.sections[0].id, known: false };
  }

  // /group alone → first section of that group (canonical).
  if (!parts[1]) {
    return { groupId: group.id, sectionId: group.sections[0].id, known: true, assetLike: false };
  }

  const section = group.sections.find((s) => s.id === parts[1]);
  if (!section) {
    return { groupId: group.id, sectionId: group.sections[0].id, known: false, assetLike: false };
  }

  return { groupId: group.id, sectionId: section.id, known: true, assetLike: false };
}

/** @deprecated use parseRoute */
export function parseHash(hash, groups) {
  return parseRoute({ hash, pathname: '/' }, groups);
}

export function routeToPath(groupId, sectionId, { chartId, search = '' } = {}) {
  const params = new URLSearchParams(search);
  params.delete('chart');
  if (chartId && readChartTarget({ search: `?chart=${chartId}` })) params.set('chart', chartId);
  const query = params.toString();
  return `/${groupId}/${sectionId}${query ? `?${query}` : ''}`;
}

export function routeToHash(groupId, sectionId) {
  return `#/${groupId}/${sectionId}`;
}

export function routeFocusIdentity(locationLike, groups) {
  const route = parseRoute(locationLike, groups);
  const path = route.known ? routeToPath(route.groupId, route.sectionId) : (locationLike?.pathname || '/');
  const hash = String(locationLike?.hash || '');
  return `${path}:${readChartTarget(locationLike) || ''}:${isRouteHash(hash) ? '' : hash}`;
}

function readLocation() {
  if (typeof window === 'undefined') return { hash: '', pathname: '/', search: '' };
  return { hash: window.location.hash, pathname: window.location.pathname, search: window.location.search };
}

/**
 * Path-based routing with hash fallback. Browser back/forward work for both.
 * Canonical form written to the address bar is /group/section (path) — only for known routes.
 */
export function useHashRoute(groups) {
  const [loc, setLoc] = useState(readLocation);
  const [focusRequest, setFocusRequest] = useState(0);
  const [missingTarget, setMissingTarget] = useState(null);
  const initialRoute = useRef(true);

  useEffect(() => {
    const sync = () => setLoc(readLocation());
    window.addEventListener('hashchange', sync);
    window.addEventListener('popstate', sync);
    return () => {
      window.removeEventListener('hashchange', sync);
      window.removeEventListener('popstate', sync);
    };
  }, []);

  const route = useMemo(() => parseRoute(loc, groups), [loc, groups]);
  const chartId = readChartTarget(loc);
  const focusKey = `${routeFocusIdentity(loc, groups)}:${focusRequest}`;

  // Canonicalise known routes only — never rewrite unknown paths to overview.
  useEffect(() => {
    if (!route.known || route.assetLike) return;
    const canonical = routeToPath(route.groupId, route.sectionId);
    const { pathname, hash, search } = window.location;
    if (pathname !== canonical || isRouteHash(hash)) {
      const params = new URLSearchParams(search);
      if (isRouteHash(hash) && hash.includes('?')) {
        new URLSearchParams(hash.slice(hash.indexOf('?'))).forEach((value, key) => params.set(key, value));
      }
      const query = params.toString();
      window.history.replaceState(null, '', `${canonical}${query ? `?${query}` : ''}${isRouteHash(hash) ? '' : hash}`);
    }
  }, [route.groupId, route.sectionId, route.known, route.assetLike, loc]);

  const navigate = useCallback((groupId, sectionId, { scrollToTop = true, chartId: targetChart } = {}) => {
    const group = groups.find((g) => g.id === groupId) || groups[0];
    const section = group.sections.find((s) => s.id === sectionId) || group.sections[0];
    const sameSection = window.location.pathname === routeToPath(group.id, section.id);
    const params = new URLSearchParams(window.location.search);
    if (!sameSection) {
      for (const key of [...params.keys()]) {
        if (key !== 'embed' && key !== 'lang') params.delete(key);
      }
    }
    const next = routeToPath(group.id, section.id, { chartId: targetChart, search: params.toString() });
    if (`${window.location.pathname}${window.location.search}${window.location.hash}` !== next) {
      window.history.pushState(null, '', next);
    }
    setLoc(readLocation());
    setFocusRequest((value) => value + 1);
    if (scrollToTop && !targetChart) window.scrollTo({ top: 0, behavior: 'instant' });
  }, [groups]);

  useEffect(() => {
    const first = initialRoute.current;
    initialRoute.current = false;
    if (first && !chartId) return undefined;
    const main = document.getElementById('main-content');
    if (!main) return undefined;
    let frame;
    let unavailableAnnounced = false;
    const focus = (target) => {
      target.focus({ preventScroll: true });
      if (target !== main) target.scrollIntoView({ block: 'start', behavior: 'instant' });
    };
    if (!chartId || !route.known) {
      frame = requestAnimationFrame(() => focus(main));
      return () => cancelAnimationFrame(frame);
    }
    const attempt = () => {
      const target = document.getElementById(chartId);
      if (target && main.contains(target)) {
        focus(target);
        setMissingTarget(null);
        observer.disconnect();
      } else if (!main.querySelector('.loading-card, [aria-busy="true"]') && !unavailableAnnounced) {
        focus(main);
        setMissingTarget(focusKey);
        unavailableAnnounced = true;
      }
    };
    const observer = new MutationObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(attempt);
    });
    observer.observe(main, { childList: true, subtree: true });
    frame = requestAnimationFrame(attempt);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [chartId, focusKey, route.known]);

  return {
    ...route,
    chartId,
    chartUnavailable: Boolean(chartId && missingTarget === focusKey),
    navigate,
    path: route.known ? routeToPath(route.groupId, route.sectionId) : (loc.pathname || '/'),
  };
}
