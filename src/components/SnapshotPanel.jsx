import { useData } from '../hooks/useData';
import { COLORS } from '../utils/chartConfig';
import './ui/SnapshotPanel.css';

function trendColor(trend) {
  if (trend === 'up') return COLORS.teal;
  if (trend === 'down') return COLORS.coral;
  return COLORS.amber;
}

function trendArrow(trend) {
  if (trend === 'up') return '▲';
  if (trend === 'down') return '▼';
  return '►';
}

/**
 * "At a glance" snapshot of headline rates, markets and fiscal stress
 * indicators. Each tile is a manually-curated, officially-sourced figure
 * with an explicit as-of date and a link to its primary source.
 */
export default function SnapshotPanel() {
  const { data, loading, error } = useData('indicators.json');

  if (loading || error || !data) return null;

  const { indicators = [], lastVerified, methodologyNote } = data;
  if (indicators.length === 0) return null;

  return (
    <div className="snapshot-panel">
      <div className="snapshot-panel__head">
        <h3>📌 Rates, Markets &amp; Fiscal Stress — at a glance</h3>
        <span className="snapshot-panel__hint">Each figure links to its official source</span>
      </div>

      <div className="snapshot-grid">
        {indicators.map((ind) => {
          const color = ind.sentiment === 'positive'
            ? COLORS.teal
            : ind.sentiment === 'negative'
              ? COLORS.coral
              : trendColor(ind.trend);
          return (
            <div key={ind.id} className="snapshot-tile card">
              <div className="snapshot-tile__label">{ind.label}</div>
              <div className="snapshot-tile__value" style={{ color }}>
                {ind.value}
                {ind.unit && <span className="snapshot-tile__unit">{ind.unit}</span>}
              </div>
              {ind.change && (
                <div className="snapshot-tile__change" style={{ color: trendColor(ind.trend) }}>
                  {trendArrow(ind.trend)} {ind.change}
                </div>
              )}
              {ind.note && <div className="snapshot-tile__note">{ind.note}</div>}
              <div className="snapshot-tile__meta">
                <span>{ind.asOf}</span>
                {ind.sourceUrl ? (
                  <a href={ind.sourceUrl} target="_blank" rel="noopener noreferrer" title={`Source: ${ind.source}`}>
                    {ind.source} ↗
                  </a>
                ) : (
                  <span>{ind.source}</span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {methodologyNote && (
        <p className="snapshot-panel__note">
          ⓘ {methodologyNote}
          {lastVerified && <> Last verified: {lastVerified}.</>}
        </p>
      )}
    </div>
  );
}
