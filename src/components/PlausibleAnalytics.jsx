import { useEffect, useRef } from 'react';

const DOMAIN = 'economyofpakistan.com';

/**
 * Cookieless pageviews. The script in index.html records the first hit;
 * later SPA navigations are sent here so section deep links show up.
 */
export default function PlausibleAnalytics({ path }) {
  const seen = useRef(true);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;
    window.plausible = window.plausible || function plausible() {
      (window.plausible.q = window.plausible.q || []).push(arguments);
    };
    return undefined;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined' || !path) return;
    if (seen.current) {
      seen.current = false;
      return;
    }
    window.plausible?.('pageview', { u: `${window.location.origin}${path}${window.location.search || ''}` });
  }, [path]);

  return null;
}

export { DOMAIN };
