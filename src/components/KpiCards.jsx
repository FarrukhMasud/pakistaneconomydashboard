import { useData } from '../hooks/useData';
import { COLORS } from '../utils/chartConfig';
import SectionHeader from './SectionHeader';

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
        description="Key macroeconomic indicators at a glance. Green arrows indicate improving trends, red arrows indicate deterioration. Data from the State Bank of Pakistan, PBS, and IMF."
      />
      <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Last updated: {lastUpdated}</p>
      <div className="kpi-grid">
        {indicators.map((kpi) => {
          const color = trendColor(kpi.trend);
          return (
            <div key={kpi.id} className={`card kpi-card trend-${kpi.trend}`}>
              <div className="kpi-label">{kpi.label}</div>
              <div className="kpi-value" style={{ color }}>
                {kpi.value}<span className="kpi-unit">{kpi.unit}</span>
              </div>
              <div className="kpi-period">{kpi.period}</div>
              <div className={`kpi-trend ${kpi.trend}`}>
                {trendArrow(kpi.trend)} {kpi.change >= 0 ? '+' : ''}{kpi.change}
              </div>
              <div className="kpi-source">Source: {kpi.source}</div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
