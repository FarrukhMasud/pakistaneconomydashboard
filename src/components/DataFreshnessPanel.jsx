import { useData, useSourcePolicies } from '../hooks/useData';
import FigureTrust from './FigureTrust';
import { LoadingCard, ErrorCard, PublicationNotice } from './ui/DataState';
import { useI18n } from '../i18n/useI18n';
import { freshnessStatus, TRUST_LABELS } from '../utils/figureTrust';

export default function DataFreshnessPanel() {
  const metadata = useData('data-freshness.json');
  const { data, loading, error, retry, dependencyErrors } = useSourcePolicies((metadata.data?.datasets || []).map((item) => item.id));
  const { t, tx } = useI18n();
  if (loading) return <LoadingCard label="Loading source audit…" />;
  if (error || !data) return <ErrorCard error={error} onRetry={retry} label="Could not load source audit" />;

  const datasets = data.datasets || [];
  const reviewCount = datasets.filter((item) => freshnessStatus(item) !== 'latest-available').length;

  return (
    <section className="trust-panel" aria-labelledby="source-trust-title">
      <h3 id="source-trust-title">{t('trust.panelTitle', 'Source trust & release status')}</h3>
      <p>{t('trust.independent', 'Authenticity, freshness and calculation validation are independent. A recent source check is not a new observation or a passed calculation check.')}</p>
      <p>{t('trust.reviewCount', '{count} datasets need review or have unavailable releases.').replace('{count}', String(reviewCount))}</p>
      {dependencyErrors.map((result) => <ErrorCard key={result.id} error={result.error} onRetry={retry} compact />)}
      <div className="trust-panel__grid">
        {datasets.map((item) => (
          <article key={item.id} className="trust-panel__item">
            <h4>{tx(item.label)}</h4>
            <p>{t(`trust.freshness.${freshnessStatus(item)}`, TRUST_LABELS.freshness[freshnessStatus(item)])}</p>
            <PublicationNotice data={item} />
            <FigureTrust datasetId={item.id} data={item} />
            <p>{t('trust.published', 'Source published')}: {item.publicationDate || t('trust.publicationUnknown', 'Publication date not stated by source')}</p>
            <p>{t('trust.changed', 'Dashboard content changed')}: {item.dashboardUpdated || '—'}</p>
            {item.reviewReason && <p>{tx(item.reviewReason)}</p>}
            {item.expectedLag && <p>{tx(item.expectedLag)}</p>}
            {item.series?.length > 0 && (
              <details>
                <summary>{t('trust.series', 'Series-level evidence')} ({item.series.length})</summary>
                {item.series.map((series) => (
                  <div key={series.id}>
                    <strong>{tx(series.label || series.id)}</strong>
                    <FigureTrust datasetId={item.id} data={item} row={series} period={series.observationDate} />
                  </div>
                ))}
              </details>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}
