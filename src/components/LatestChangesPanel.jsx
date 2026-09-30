import { useData, useSourcePolicies } from '../hooks/useData';
import useI18n from '../i18n/useI18n';
import FigureTrust from './FigureTrust';
import { ErrorCard } from './ui/DataState';
import { classifyObservationChange, KPI_DATASETS, previewItemAllowed } from '../utils/figureTrust';

function formatValue(value, unit) {
  if (value == null) return '—';
  return `${value}${unit ? ` ${unit}` : ''}`;
}

export default function LatestChangesPanel() {
  const { tx } = useI18n();
  const { data, loading, error, retry } = useData('update-preview.json');
  const freshness = useSourcePolicies([
    ...(data?.newObservations || []), ...(data?.majorMovements || []), ...(data?.newRevisions || []),
  ].map((item) => item.dataset || item.datasetId || KPI_DATASETS[item.id]?.[0]));
  if (error || freshness.error) return <ErrorCard error={error || freshness.error} onRetry={error ? retry : freshness.retry} compact />;
  if (loading || !data || freshness.loading) return null;

  const allowed = (item) => previewItemAllowed(item, freshness.data);
  const observations = (data.newObservations || []).filter(allowed).filter((item) =>
    classifyObservationChange({ date: item.from }, { date: item.to }) === 'new-observation').slice(0, 5);
  const movements = (data.majorMovements || []).filter(allowed).filter((item) => Number.isFinite(item.from) && Number.isFinite(item.to)).slice(0, 5);
  const revisions = (data.newRevisions || []).filter(allowed).slice(0, 4);
  const alerts = [
    ...(data.suspiciousDateJumps || []).map((item) => ({
      label: item.label,
      detail: `${item.type}: ${item.from} → ${item.to}`,
    })),
    ...(data.reviewRequired || []).map((item) => ({
      label: item.label,
      detail: item.reason,
    })),
  ].slice(0, 5);

  if (!observations.length && !movements.length && !revisions.length && !alerts.length && !freshness.dependencyErrors.length) return null;

  return (
    <section className="latest-changes card" aria-labelledby="latest-changes-title">
      {freshness.dependencyErrors.map((result) => <ErrorCard key={result.id} error={result.error} onRetry={freshness.retry} compact />)}
      <div className="latest-changes__header">
        <div>
          <span className="latest-changes__eyebrow">{tx('Latest refresh')}</span>
          <h3 id="latest-changes-title">{tx('What changed in the data')}</h3>
        </div>
        <time dateTime={data.generatedAt}>{String(data.generatedAt || '').slice(0, 10)}</time>
      </div>

      <div className="latest-changes__grid">
        {observations.length > 0 && (
          <div>
            <h4>{tx('New observations')}</h4>
            <ul>
              {observations.map((item) => (
                <li key={`${item.dataset}-${item.to}`}>
                  <strong>{item.label}</strong>
                  <span>{item.from || tx('New series')} → {item.to}</span>
                  <FigureTrust datasetId={item.dataset} row={item} period={item.to} compact />
                </li>
              ))}
            </ul>
          </div>
        )}

        {movements.length > 0 && (
          <div>
            <h4>{tx('KPI movements')}</h4>
            <ul>
              {movements.map((item) => (
                <li key={item.id}>
                  <strong>{item.label}</strong>
                  <span>{formatValue(item.from, item.unit)} → {formatValue(item.to, item.unit)}</span>
                  <FigureTrust datasetId={item.dataset || KPI_DATASETS[item.id]?.[0]} row={item} period={item.period} compact />
                </li>
              ))}
            </ul>
          </div>
        )}

        {revisions.length > 0 && (
          <div>
            <h4>{tx('Revisions')}</h4>
            <ul>
              {revisions.map((item) => (
                <li key={`${item.dataset}-${item.path}-${item.date}`}>
                  <strong>{item.dataset}</strong>
                  <span>{item.path}: {item.from} → {item.to}</span>
                  <FigureTrust datasetId={item.dataset} row={item} period={item.date} compact />
                </li>
              ))}
            </ul>
          </div>
        )}

        {alerts.length > 0 && (
          <div className="latest-changes__alerts">
            <h4>{tx('Needs review')}</h4>
            <ul>
              {alerts.map((item) => (
                <li key={`${item.label}-${item.detail}`}>
                  <strong>{item.label}</strong>
                  <span>{item.detail}</span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </section>
  );
}
