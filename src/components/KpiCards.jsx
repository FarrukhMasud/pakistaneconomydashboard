import { useData } from '../hooks/useData';
import { COLORS } from '../utils/chartConfig';
import SectionHeader from './SectionHeader';
import DataFreshnessPanel from './DataFreshnessPanel';
import ExpandableTile from './ui/ExpandableTile';

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

export default function KpiCards() {
  const { data, loading, error } = useData('kpi-summary.json');

  if (loading || !data) return <div className="card loading-card"><div className="spinner" /><span>Loading overview…</span></div>;
  if (error) return <p style={{ color: COLORS.coral }}>Error: {error.message}</p>;

  const { lastUpdated, indicators } = data;

  return (
    <section className="fade-in">
      <SectionHeader
        title="Economic Overview"
        description="Key macroeconomic indicators at a glance. These headline numbers summarize Pakistan's economic health — from external accounts (reserves, trade, remittances) to domestic conditions (growth, inflation, monetary policy). Green arrows indicate improving trends; red indicates deterioration."
        sourceLinks={[
          { label: 'SBP EasyData Portal', url: 'https://easydata.sbp.org.pk' },
          { label: 'PBS Statistics', url: 'https://www.pbs.gov.pk' },
        ]}
      />
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>
        Data refreshed: {lastUpdated} · All values derived from source datasets
      </p>
      <div className="kpi-grid">
        {indicators.map((kpi) => {
          const color = trendColor(kpi.trend);
          return (
            <ExpandableTile
              key={kpi.id}
              className={`card kpi-card trend-${kpi.trend}`}
              title={kpi.label}
              subtitle={`${kpi.period} · Source: ${kpi.source}`}
              details={(
                <div className="tile-detail-list">
                  <div className="tile-detail-row">
                    <span>Latest value</span>
                    <strong style={{ color }}>{kpi.value}{kpi.unit}</strong>
                  </div>
                  <div className="tile-detail-row">
                    <span>Period</span>
                    <strong>{kpi.period}</strong>
                  </div>
                  <div className="tile-detail-row">
                    <span>Change</span>
                    <strong>{trendArrow(kpi.trend)} {kpi.change >= 0 ? '+' : ''}{kpi.change}</strong>
                  </div>
                  {kpi.sub && (
                    <div className="tile-detail-row">
                      <span>Context</span>
                      <strong>{kpi.sub}</strong>
                    </div>
                  )}
                  <div className="tile-detail-row">
                    <span>Source</span>
                    <strong>{kpi.source}</strong>
                  </div>
                </div>
              )}
            >
              <div className="kpi-label">{kpi.label}</div>
              <div className="kpi-value" style={{ color }}>
                {kpi.value}<span className="kpi-unit">{kpi.unit}</span>
              </div>
              <div className="kpi-period">{kpi.period}</div>
              {kpi.sub && <div className="kpi-sub">{kpi.sub}</div>}
              <div className={`kpi-trend ${kpi.trend}`}>
                {trendArrow(kpi.trend)} {kpi.change >= 0 ? '+' : ''}{kpi.change}
              </div>
              <div className="kpi-source">Source: {kpi.source}</div>
            </ExpandableTile>
          );
        })}
      </div>
      <DataFreshnessPanel />
    </section>
  );
}
