import { useEffect, useState } from 'react';
import useI18n from '../i18n/useI18n';

/**
 * Shows a refresh prompt when a new service worker takes control
 * or the build data version changes while the tab stays open.
 */
export default function UpdateToast({ blocked = false }) {
  const { t } = useI18n();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const show = () => setVisible(true);
    const onControllerChange = () => show();

    // Detect SW takeover (new deploy).
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('controllerchange', onControllerChange);
    }

    // Detect live-tab data version bump (devtools / multi-tab deploy).
    const bootVersion = import.meta.env.VITE_DATA_VERSION || 'dev';
    let cancelled = false;
    const poll = async () => {
      try {
        const res = await fetch(`/data/kpi-summary.json?check=${Date.now()}`, {
          cache: 'no-store',
          headers: { Accept: 'application/json' },
        });
        if (!res.ok || cancelled) return;
        const payload = await res.json();
        const remoteStamp = payload?.lastUpdated || payload?.lastChecked;
        const localStamp = window.__pakEcoBootStamp;
        if (!window.__pakEcoBootStamp) {
          window.__pakEcoBootStamp = remoteStamp || bootVersion;
          return;
        }
        if (remoteStamp && localStamp && remoteStamp !== localStamp) {
          show();
        }
      } catch {
        /* offline — ignore */
      }
    };

    // Light poll every 15 minutes in production only.
    let timer;
    if (import.meta.env.PROD) {
      timer = window.setInterval(poll, 15 * 60 * 1000);
      poll();
    }

    return () => {
      cancelled = true;
      if (timer) window.clearInterval(timer);
      if ('serviceWorker' in navigator) {
        navigator.serviceWorker.removeEventListener('controllerchange', onControllerChange);
      }
    };
  }, []);

  if (!visible || blocked) return null;

  return (
    <div className="update-toast" role="status" aria-live="polite">
      <span>{t('update.available', 'New data available')}</span>
      <button type="button" className="update-toast__refresh" onClick={() => window.location.reload()}>
        {t('update.refresh', 'Refresh')}
      </button>
      <button
        type="button"
        className="update-toast__dismiss"
        onClick={() => setVisible(false)}
        aria-label={t('common.close', 'Close')}
      >
        ×
      </button>
    </div>
  );
}
