import useI18n from '../../i18n/useI18n';
import { COLORS } from '../../utils/chartConfig';
import { fmt } from './helpers.js';

export function ProgressMeter({ label, value, max, color = COLORS.teal, detail }) {
  const { tx } = useI18n();
  const pct = max ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div className="progress-meter">
      <div className="progress-meter__top">
        <span>{tx(label)}</span>
        <strong>{fmt(value, 0)} / {fmt(max, 0)}</strong>
      </div>
      <div className="progress-meter__track">
        <span style={{ width: `${pct}%`, background: color }} />
      </div>
      {detail && <small>{detail}</small>}
    </div>
  );
}

export function InsightCard({ title, value, meta, body, source, sourceUrl, tone = 'neutral' }) {
  const { tx } = useI18n();
  return (
    <article className={`insight-card insight-card--${tone}`}>
      <div className="insight-card__top">
        <h3>{tx(title)}</h3>
        <span className="official-badge">{tx('Official data')}</span>
      </div>
      <div className="insight-card__value">{value}</div>
      {meta && <div className="insight-card__meta">{meta}</div>}
      <p>{body}</p>
      {sourceUrl ? (
        <a className="insight-card__source" href={sourceUrl} target="_blank" rel="noreferrer">{source} ↗</a>
      ) : (
        <span className="insight-card__source">{source}</span>
      )}
    </article>
  );
}

export function PartialFailureNote({ failed, onRetry }) {
  const { t } = useI18n();
  if (!failed?.length) return null;
  return (
    <div className="insight-note insight-note--warn" role="status">
      {t('common.partialFailure', 'Some datasets failed to load; this view may be incomplete.')}
      {' '}
      <button type="button" className="data-state-card__retry" onClick={onRetry}>
        {t('common.retry', 'Try again')}
      </button>
    </div>
  );
}
