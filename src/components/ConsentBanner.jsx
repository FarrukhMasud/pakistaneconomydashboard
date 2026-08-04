import { useEffect, useState } from 'react';
import useI18n from '../i18n/useI18n';

const STORAGE_KEY = 'pak-eco-analytics-consent';
const CONSENT_EVENT = 'pak-eco:consent-decided';
const CLARITY_ID = 'wf9unpmskv';

function loadClarity(id) {
  if (typeof window === 'undefined' || window.clarity) return;
  (function (c, l, a, r, i, t, y) {
    c[a] = c[a] || function () { (c[a].q = c[a].q || []).push(arguments); };
    t = l.createElement(r); t.async = 1; t.src = `https://www.clarity.ms/tag/${i}`;
    y = l.getElementsByTagName(r)[0]; y.parentNode.insertBefore(t, y);
  })(window, document, 'clarity', 'script', id);
}

/**
 * Gates Microsoft Clarity behind an explicit consent choice.
 * Prior accept/decline is remembered in localStorage.
 */
export default function ConsentBanner() {
  const { t } = useI18n();
  const [choice, setChoice] = useState(() => {
    if (typeof window === 'undefined') return 'unknown';
    return window.localStorage.getItem(STORAGE_KEY) || 'pending';
  });

  useEffect(() => {
    if (choice === 'accepted') loadClarity(CLARITY_ID);
  }, [choice]);

  if (choice !== 'pending') return null;

  const decide = (value) => {
    window.localStorage.setItem(STORAGE_KEY, value);
    setChoice(value);
    window.dispatchEvent(new CustomEvent(CONSENT_EVENT, { detail: value }));
  };

  return (
    <div className="consent-banner" role="dialog" aria-label={t('consent.title', 'Analytics cookies')}>
      <p>
        {t(
          'consent.body',
          'We use optional anonymous analytics (Microsoft Clarity) to improve the dashboard. No ads. Choose accept or decline.',
        )}
      </p>
      <div className="consent-banner__actions">
        <button type="button" className="consent-banner__btn consent-banner__btn--secondary" onClick={() => decide('declined')}>
          {t('consent.decline', 'Decline')}
        </button>
        <button type="button" className="consent-banner__btn consent-banner__btn--primary" onClick={() => decide('accepted')}>
          {t('consent.accept', 'Accept analytics')}
        </button>
      </div>
    </div>
  );
}
