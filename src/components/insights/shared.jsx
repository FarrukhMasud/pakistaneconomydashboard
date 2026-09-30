import useI18n from '../../i18n/useI18n';
import { COLORS } from '../../utils/chartConfig';
import { fmt } from './helpers.js';
import FigureTrust from '../FigureTrust';
import { PublicationNotice, UnavailableCard } from '../ui/DataState';

export function ProgressMeter({ label, value, max, color = COLORS.teal, detail, datasetId, row, period, derivation = 'value ÷ maximum × 100' }) {
  const { tx } = useI18n();
  const pct = Number.isFinite(value) && Number.isFinite(max) && max > 0
    ? Math.min(100, Math.max(0, (value / max) * 100)) : null;
  return (
    <div className="progress-meter">
      <div className="progress-meter__top">
        <span>{tx(label)}</span>
        <strong>{fmt(value, 0)} / {fmt(max, 0)}</strong>
      </div>
      {pct != null && <div className="progress-meter__track">
        <span style={{ width: `${pct}%`, background: color }} />
      </div>}
      <FigureTrust datasetId={datasetId} row={row} period={period} derivation={derivation} compact />
      {detail && <small>{detail}</small>}
    </div>
  );
}

export function InsightCard({ title, value, meta, body, source, sourceUrl, tone = 'neutral', datasetId, row, derivation, period }) {
  const { t, tx } = useI18n();
  const unavailable = value == null || value === '—';
  return (
    <article className={`insight-card insight-card--${unavailable ? 'neutral' : tone}`}>
      <div className="insight-card__top">
        <h3>{tx(title)}</h3>
      </div>
      <div className="insight-card__value">{unavailable ? t('trust.unavailableShort', 'Unavailable') : value}</div>
      <FigureTrust datasetId={datasetId} row={unavailable ? { ...row, sourceUrl, authenticity: 'unavailable' } : row || { sourceUrl }}
        period={period || row?.date || row?.asOf || row?.period || row?.latestMonth || row?.fyLabel} derivation={derivation} compact />
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
    <div>
      {failed.map((result, index) => result.unavailable
        ? <UnavailableCard key={index} {...result.unavailable} compact />
        : <PublicationNotice key={index} data={result.data} compact />)}
      {failed.some((result) => result.error) && <div className="insight-note insight-note--warn" role="status">
        {t('common.partialFailure', 'Some datasets failed to load; this view may be incomplete.')}
        {' '}
        <button type="button" className="data-state-card__retry" onClick={onRetry}>
        {t('common.retry', 'Try again')}
        </button>
      </div>}
    </div>
  );
}

export function TrustedContextValue({ label, value, detail, period, datasetId, row, derivation }) {
  const { t, tx } = useI18n();
  const unavailable = value == null || value === '—';
  return <div>
    <span>{tx(label)}</span><strong>{unavailable ? t('trust.unavailableShort', 'Unavailable') : value}</strong>
    <small>{period || detail}</small>
    <FigureTrust datasetId={datasetId} row={unavailable ? { ...row, authenticity: 'unavailable' } : row}
      period={period} derivation={derivation} compact />
  </div>;
}
