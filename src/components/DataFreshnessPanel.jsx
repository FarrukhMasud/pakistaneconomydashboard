import { useData } from '../hooks/useData';
import SourceBadge from './SourceBadge';
import { useI18n } from '../i18n/useI18n';

function statusKey(status) {
  if (status === 'fresh') return 'freshness.fresh';
  if (status === 'missing') return 'freshness.missing';
  return 'freshness.review';
}

export default function DataFreshnessPanel() {
  const { data, loading, error } = useData('data-freshness.json');
  const { t, tx } = useI18n();
  const statusLabel = (status) => t(statusKey(status));

  if (loading || !data) {
    return <div className="card loading-card"><div className="spinner" /><span>{tx('Loading source audit\u2026')}</span></div>;
  }
  if (error) return null;

  const datasets = data.datasets || [];

  return (
    <section className="data-freshness card">
      <div className="data-freshness__header">
        <div>
          <h3>{t('freshness.title')}</h3>
          <p>{t('freshness.subtitle')}</p>
        </div>
        <span className={`freshness-badge freshness-badge--${data.status}`}>
          <span className="freshness-badge__dot" />
          {statusLabel(data.status)}
        </span>
      </div>

      <div className="freshness-grid">
        {datasets.map((item) => (
          <a
            key={item.id}
            className="freshness-item"
            href={item.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            title={item.expectedLag}
          >
            <div className="freshness-item__top">
              <strong>{item.label}</strong>
              <span className={`freshness-status freshness-status--${item.status}`}>
                {statusLabel(item.status)}
              </span>
            </div>
            <div className="freshness-item__meta">
              <SourceBadge sourceType={item.sourceType} compact />
              <span>{t('common.latest')}: {item.latestObservation || 'N/A'}</span>
              <span>{t('common.updated')}: {item.dashboardUpdated || 'N/A'}</span>
              {item.sourceFile && <span>{tx('Source file:')} {item.sourceFile}</span>}
              {item.apiSeries?.length > 0 && <span>{tx('API series:')} {item.apiSeries.length}</span>}
              <span>{item.sourceLabel || item.source}</span>
              {item.reviewReason && <small><strong>{tx("Review note:")}</strong> {item.reviewReason}</small>}
              {item.expectedLag && <small>{item.expectedLag}</small>}
            </div>
          </a>
        ))}
      </div>
    </section>
  );
}
