import { useData } from '../hooks/useData';
import { COLORS } from '../utils/chartConfig';
import SectionHeader from './SectionHeader';
import DataFreshnessPanel from './DataFreshnessPanel';
import ReleaseCalendarSection from './ReleaseCalendarSection';
import SnapshotPanel from './SnapshotPanel';
import CiteFigure from './CiteFigure';
import ExpandableTile from './ui/ExpandableTile';
import useI18n from '../i18n/useI18n';

function sentimentColor(sentiment) {
  if (sentiment === 'positive') return COLORS.teal;
  if (sentiment === 'negative') return COLORS.coral;
  return COLORS.amber;
}

function trendArrow(trend) {
  if (trend === 'up') return '▲';
  if (trend === 'down') return '▼';
  return '►';
}

function formatValue(kpi) {
  if (!Number.isFinite(kpi.value)) return String(kpi.value ?? '—');
  return Number.isFinite(kpi.decimals) ? kpi.value.toFixed(kpi.decimals) : String(kpi.value);
}

/**
 * KPI changes are not all the same kind of number — some are percentage-point
 * moves, some are absolute $bn moves, some are percent growth. Render the unit
 * the parser recorded rather than a bare, ambiguous figure.
 */
function formatChange(kpi) {
  if (!Number.isFinite(kpi.change)) return null;
  const sign = kpi.change > 0 ? '+' : '';
  const unit = kpi.changeUnit || '';
  if (unit === '%' || unit === 'pp') return `${sign}${kpi.change}${unit}`;
  if (unit) return `${sign}${kpi.change} ${unit}`;
  return `${sign}${kpi.change}`;
}

export default function KpiCards() {
  const { tx } = useI18n();
  const { data, loading, error } = useData('kpi-summary.json');

  if (loading || !data) return <div className="card loading-card"><div className="spinner" /><span>Loading overview…</span></div>;
  if (error) return <p style={{ color: COLORS.coral }}>Error: {error.message}</p>;

  const { lastUpdated, indicators } = data;

  return (
    <section className="fade-in">
      <SectionHeader
        title="Economic Overview"
        description="Key macroeconomic indicators at a glance. These headline numbers summarize Pakistan's economic health — from external accounts (reserves, trade, remittances) to domestic conditions (growth, inflation, monetary policy). Arrows show the direction of change; color reflects whether that movement is favorable, unfavorable, or neutral for the indicator."
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
          const sentiment = kpi.sentiment || 'neutral';
          const color = sentimentColor(sentiment);
          const changeLabel = formatChange(kpi);
          return (
            <ExpandableTile
              key={kpi.id}
              className={`card kpi-card sentiment-${sentiment}`}
              title={kpi.label}
              subtitle={`${kpi.period} · Source: ${kpi.source}`}
              details={(
                <div className="tile-detail-list">
                  <div className="tile-detail-row">
                    <span>{tx("Latest value")}</span>
                    <strong style={{ color }}>{formatValue(kpi)}{kpi.unit}</strong>
                  </div>
                  <div className="tile-detail-row">
                    <span>{tx("Period")}</span>
                    <strong>{kpi.period}</strong>
                  </div>
                  <div className="tile-detail-row">
                    <span>{tx("Change")}</span>
                    <strong>{trendArrow(kpi.trend)} {changeLabel ?? 'n/a'}</strong>
                  </div>
                  {kpi.changeBasis && (
                    <div className="tile-detail-row">
                      <span>{tx("Compared with")}</span>
                      <strong>{kpi.changeBasis}</strong>
                    </div>
                  )}
                  {kpi.sub && (
                    <div className="tile-detail-row">
                      <span>{tx("Context")}</span>
                      <strong>{kpi.sub}</strong>
                    </div>
                  )}
                  <div className="tile-detail-row">
                    <span>{tx("Source")}</span>
                    <strong>{kpi.source}</strong>
                  </div>
                </div>
              )}
            >
              <div className="kpi-label">{kpi.label}</div>
              <div className="kpi-value" style={{ color }}>
                {formatValue(kpi)}<span className="kpi-unit">{kpi.unit}</span>
              </div>
              <div className="kpi-period">{kpi.period}</div>
              {kpi.sub && <div className="kpi-sub">{kpi.sub}</div>}
              <div className={`kpi-trend ${sentiment}`} title={kpi.changeBasis || undefined}>
                {trendArrow(kpi.trend)} {changeLabel ?? 'n/a'}
                {kpi.changeBasis && <span className="kpi-change-basis"> {kpi.changeBasis}</span>}
              </div>
              <div className="kpi-source">
                Source: {kpi.source}
                {kpi.provenanceKey && <CiteFigure figureKey={kpi.provenanceKey} compact />}
              </div>
            </ExpandableTile>
          );
        })}
      </div>
      <SnapshotPanel />
      <ReleaseCalendarSection compact />
      <DataFreshnessPanel />
    </section>
  );
}
