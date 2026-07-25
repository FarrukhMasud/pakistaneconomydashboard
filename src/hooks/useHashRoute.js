import { useCallback, useEffect, useMemo, useState } from 'react';

/**
 * Parses `#/group/section` into a validated route. Anything unrecognised falls
 * back to the first group/section so a stale bookmark can never render blank.
 */
export function parseHash(hash, groups) {
  const parts = String(hash || '')
    .replace(/^#\/?/, '')
    .split('/')
    .map((part) => decodeURIComponent(part.trim()))
    .filter(Boolean);

  const group = groups.find((g) => g.id === parts[0]) || groups[0];
  const section = group.sections.find((s) => s.id === parts[1]) || group.sections[0];
  return { groupId: group.id, sectionId: section.id };
}

export function routeToHash(groupId, sectionId) {
  return `#/${groupId}/${sectionId}`;
}

/**
 * Hash-based routing so every section is deep-linkable, shareable and
 * navigable with the browser's back/forward buttons.
 */
export function useHashRoute(groups) {
  const [hash, setHash] = useState(() => (typeof window === 'undefined' ? '' : window.location.hash));

  useEffect(() => {
    const onHashChange = () => setHash(window.location.hash);
    window.addEventListener('hashchange', onHashChange);
    window.addEventListener('popstate', onHashChange);
    return () => {
      window.removeEventListener('hashchange', onHashChange);
      window.removeEventListener('popstate', onHashChange);
    };
  }, []);

  const route = useMemo(() => parseHash(hash, groups), [hash, groups]);

  // Canonicalise the address bar so a bare "/" or a bad hash becomes a real,
  // copyable deep link. The derived route is already correct, so this only
  // rewrites the URL — it deliberately does not re-set state.
  useEffect(() => {
    const canonical = routeToHash(route.groupId, route.sectionId);
    if (window.location.hash !== canonical) {
      window.history.replaceState(null, '', canonical);
    }
  }, [route.groupId, route.sectionId]);

  const navigate = useCallback((groupId, sectionId, { scrollToTop = true } = {}) => {
    const group = groups.find((g) => g.id === groupId) || groups[0];
    const section = group.sections.find((s) => s.id === sectionId) || group.sections[0];
    const next = routeToHash(group.id, section.id);
    if (window.location.hash !== next) {
      window.history.pushState(null, '', next);
      setHash(next);
    }
    if (scrollToTop) window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [groups]);

  return { ...route, navigate };
}
