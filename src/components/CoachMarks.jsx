import { useEffect, useMemo, useState } from 'react';
import useI18n from '../i18n/useI18n';
import { COACH_STORAGE_KEY } from '../utils/startupState';

function readDone() {
  try {
    return localStorage.getItem(COACH_STORAGE_KEY) === '1';
  } catch {
    return true;
  }
}

/**
 * Lightweight first-visit coach marks for search, density, and pins.
 */
export default function CoachMarks({ enabled = true, onFinished }) {
  const { t } = useI18n();
  const steps = useMemo(() => [
    {
      id: 'search',
      title: t('coach.searchTitle', 'Jump anywhere'),
      body: t('coach.searchBody', 'Press Ctrl/Cmd+K to search sections and indicators instantly.'),
    },
    {
      id: 'density',
      title: t('coach.densityTitle', 'Roomy or compact'),
      body: t('coach.densityBody', 'Toggle density in the top bar when you want denser charts on a laptop.'),
    },
    {
      id: 'pins',
      title: t('coach.pinsTitle', 'Build a watchlist'),
      body: t('coach.pinsBody', 'Pin KPIs with ★ on Overview — they stay on this device for quick checks.'),
    },
  ], [t]);

  const [open, setOpen] = useState(false);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (!enabled || readDone()) return undefined;
    const id = window.setTimeout(() => setOpen(true), 900);
    return () => window.clearTimeout(id);
  }, [enabled]);

  const finish = () => {
    try {
      localStorage.setItem(COACH_STORAGE_KEY, '1');
    } catch {
      /* ignore */
    }
    setOpen(false);
    onFinished?.();
  };

  if (!open) return null;

  const step = steps[index];
  const isLast = index >= steps.length - 1;

  return (
    <div className="coach-marks" role="dialog" aria-modal="true" aria-labelledby="coach-title">
      <div className="coach-card">
        <div className="coach-card__step">
          {t('coach.step', 'Tip {n} of {total}')
            .replace('{n}', String(index + 1))
            .replace('{total}', String(steps.length))}
        </div>
        <h3 id="coach-title">{step.title}</h3>
        <p>{step.body}</p>
        <div className="coach-card__actions">
          <button type="button" className="btn-ghost" onClick={finish}>
            {t('coach.skip', 'Skip')}
          </button>
          {!isLast ? (
            <button type="button" className="btn-primary" onClick={() => setIndex((i) => i + 1)}>
              {t('coach.next', 'Next')}
            </button>
          ) : (
            <button type="button" className="btn-primary" onClick={finish}>
              {t('coach.done', 'Got it')}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
