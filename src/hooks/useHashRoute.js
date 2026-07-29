import { useCallback, useEffect, useMemo, useState } from 'react';

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
  if (hash && hash !== '#' && hash !== '#/') {
    raw = hash.replace(/^#\/?/, '');
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

export function routeToPath(groupId, sectionId) {
  return `/${groupId}/${sectionId}`;
}

export function routeToHash(groupId, sectionId) {
  return `#/${groupId}/${sectionId}`;
}

function readLocation() {
  if (typeof window === 'undefined') return { hash: '', pathname: '/' };
  return { hash: window.location.hash, pathname: window.location.pathname };
}

/**
 * Path-based routing with hash fallback. Browser back/forward work for both.
 * Canonical form written to the address bar is /group/section (path) — only for known routes.
 */
export function useHashRoute(groups) {
  const [loc, setLoc] = useState(readLocation);

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

  // Canonicalise known routes only — never rewrite unknown paths to overview.
  useEffect(() => {
    if (!route.known || route.assetLike) return;
    const canonical = routeToPath(route.groupId, route.sectionId);
    const { pathname, hash, search } = window.location;
    if (pathname !== canonical || hash) {
      window.history.replaceState(null, '', `${canonical}${search || ''}`);
    }
  }, [route.groupId, route.sectionId, route.known, route.assetLike]);

  const navigate = useCallback((groupId, sectionId, { scrollToTop = true } = {}) => {
    const group = groups.find((g) => g.id === groupId) || groups[0];
    const section = group.sections.find((s) => s.id === sectionId) || group.sections[0];
    const next = routeToPath(group.id, section.id);
    if (window.location.pathname !== next || window.location.hash) {
      window.history.pushState(null, '', next);
      setLoc(readLocation());
    }
    if (scrollToTop) window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [groups]);

  return {
    ...route,
    navigate,
    path: route.known ? routeToPath(route.groupId, route.sectionId) : (loc.pathname || '/'),
  };
}
