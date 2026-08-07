import { useData } from '../hooks/useData';
import useI18n from '../i18n/useI18n';

function formatValue(value, unit) {
  if (value == null) return '—';
  return `${value}${unit ? ` ${unit}` : ''}`;
}

export default function LatestChangesPanel() {
  const { tx } = useI18n();
  const { data, loading, error } = useData('update-preview.json');
  if (loading || error || !data) return null;

  const observations = (data.newObservations || []).slice(0, 5);
  const movements = (data.majorMovements || []).slice(0, 5);
  const revisions = (data.newRevisions || []).slice(0, 4);
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

  if (!observations.length && !movements.length && !revisions.length && !alerts.length) return null;

  return (
    <section className="latest-changes card" aria-labelledby="latest-changes-title">
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
