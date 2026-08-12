import { useEffect, useState } from 'react';
import { useData } from '../hooks/useData';
import { useWatchlist } from '../hooks/useWatchlist';
import { COLORS } from '../utils/chartConfig';
import SectionHeader from './SectionHeader';
import DataFreshnessPanel from './DataFreshnessPanel';
import ReleaseCalendarSection from './ReleaseCalendarSection';
import SnapshotPanel from './SnapshotPanel';
import CiteFigure from './CiteFigure';
import WhatMovedStrip from './WhatMovedStrip';
import LatestChangesPanel from './LatestChangesPanel';
import WatchlistPanel from './WatchlistPanel';
import EconomyPulse from './EconomyPulse';
import SourceBadge from './SourceBadge';
import ExpandableTile from './ui/ExpandableTile';
import AnimatedNumber from './ui/AnimatedNumber';
import { LoadingCard, ErrorCard } from './ui/DataState';
import useI18n from '../i18n/useI18n';
import {
  formatKpiNumber,
  formatKpiPeriod,
  formatKpiUnit,
  getKpiDecimals,
  isProvisionalPeriod,
} from '../utils/kpiFormat';

const KPI_DATASETS = {
  reserves: 'reserves',
  'exchange-rate': 'exchange-rates',
  remittances: 'remittances',
  fdi: 'fdi',
  it_exports: 'services',
  'gdp-growth': 'fiscal',
  inflation: 'inflation',
  'fbr-tax': 'fbr-tax',
  'policy-rate': 'monetary-policy',
};

function useOverviewLayout() {
  const [layout, setLayout] = useState(() => {
    const mobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches;
    return { mobile, detailsOpen: !mobile };
  });

  useEffect(() => {
    const query = window.matchMedia('(max-width: 720px)');
    const update = (event) => {
      setLayout({ mobile: event.matches, detailsOpen: !event.matches });
    };
    if (query.addEventListener) query.addEventListener('change', update);
    else query.addListener(update);
    return () => {
      if (query.removeEventListener) query.removeEventListener('change', update);
      else query.removeListener(update);
    };
  }, []);

  const setDetailsOpen = (detailsOpen) => {
    setLayout((current) => ({ ...current, detailsOpen }));
  };

  return { ...layout, setDetailsOpen };
}

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
  const { t, tx } = useI18n();
  const { data, loading, error, retry } = useData('kpi-summary.json');
  const { isPinned, toggle } = useWatchlist();
  const { mobile: isMobile, detailsOpen, setDetailsOpen } = useOverviewLayout();
  const [showAllIndicators, setShowAllIndicators] = useState(false);

  // navigate only — NAV_GROUPS not needed here; use window history via custom helper
  const navigate = (groupId, sectionId) => {
    const path = `/${groupId}/${sectionId}`;
    window.history.pushState(null, '', path);
    window.dispatchEvent(new PopStateEvent('popstate'));
  };

  if (loading) return <LoadingCard label="Loading overview…" />;
  if (error || !data) return <ErrorCard error={error} onRetry={retry} label="Could not load economic overview" />;

  const { lastUpdated, indicators } = data;
  const visibleIndicators = isMobile && !showAllIndicators ? indicators.slice(0, 6) : indicators;

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
      <EconomyPulse onNavigate={navigate} />
      <WhatMovedStrip onNavigate={navigate} />
      <div className="kpi-grid stagger-children">
        {visibleIndicators.map((kpi) => {
          const sentiment = kpi.sentiment || 'neutral';
          const color = sentimentColor(sentiment);
          const changeLabel = formatChange(kpi);
          const pinned = isPinned(kpi.id);
          return (
            <ExpandableTile
              key={kpi.id}
              className={`card kpi-card sentiment-${sentiment}`}
              title={kpi.label}
              subtitle={`${formatKpiPeriod(kpi.period)} · Source: ${kpi.source}`}
              details={(
                <div className="tile-detail-list">
                  <div className="tile-detail-row">
                    <span>{tx('Latest value')}</span>
                    <strong style={{ color }}>{formatKpiNumber(kpi)} {formatKpiUnit(kpi.unit)}</strong>
                  </div>
                  <div className="tile-detail-row">
                    <span>{tx('Period')}</span>
                    <strong>{formatKpiPeriod(kpi.period)}</strong>
                  </div>
                  <div className="tile-detail-row">
                    <span>{tx('Change')}</span>
                    <strong>{trendArrow(kpi.trend)} {changeLabel ?? 'n/a'}</strong>
                  </div>
                  {kpi.changeBasis && (
                    <div className="tile-detail-row">
                      <span>{tx('Compared with')}</span>
                      <strong>{kpi.changeBasis}</strong>
                    </div>
                  )}
                  {kpi.sub && (
                    <div className="tile-detail-row">
                      <span>{tx('Context')}</span>
                      <strong>{kpi.sub}</strong>
                    </div>
                  )}
                  <div className="tile-detail-row">
                    <span>{tx('Source')}</span>
                    <strong>{kpi.source}</strong>
                  </div>
                  {kpi.provenanceKey && (
                    <div className="tile-detail-row">
                      <span>{tx('Citation')}</span>
                      <CiteFigure figureKey={kpi.provenanceKey} />
                    </div>
                  )}
                </div>
              )}
            >
              <div className="kpi-label-row">
                <div className="kpi-label-meta">
                  <div className="kpi-label">{kpi.label}</div>
                  <SourceBadge
                    datasetId={KPI_DATASETS[kpi.id]}
                    sourceType={kpi.sourceType}
                    compact
                  />
                </div>
                <button
                  type="button"
                  className={`kpi-pin ${pinned ? 'is-pinned' : ''}`}
                  aria-pressed={pinned}
                  aria-label={pinned ? t('watchlist.unpin', 'Unpin') : t('watchlist.pin', 'Pin to watchlist')}
                  title={pinned ? t('watchlist.unpin', 'Unpin') : t('watchlist.pin', 'Pin to watchlist')}
                  onClick={(event) => {
                    event.stopPropagation();
                    toggle(kpi.id);
                  }}
                >
                  {pinned ? '★' : '☆'}
                </button>
              </div>
              <div className="kpi-value" style={{ color }}>
                {Number.isFinite(kpi.value) ? (
                  <AnimatedNumber
                    value={kpi.value}
                    decimals={getKpiDecimals(kpi)}
                  />
                ) : formatKpiNumber(kpi)}
                {' '}
                <span className="kpi-unit">{formatKpiUnit(kpi.unit)}</span>
              </div>
              <div className="kpi-period">
                {formatKpiPeriod(kpi.period)}
                {isProvisionalPeriod(kpi.period) && <span className="provisional-badge">{tx('Provisional')}</span>}
              </div>
              {kpi.sub && <div className="kpi-sub">{kpi.sub}</div>}
              <div className={`kpi-trend ${sentiment}`} title={kpi.changeBasis || undefined}>
                {trendArrow(kpi.trend)} {changeLabel ?? 'n/a'}
                {kpi.changeBasis && <span className="kpi-change-basis"> {kpi.changeBasis}</span>}
              </div>
              <div className="kpi-source">
                Source: {kpi.source}
                {kpi.provenanceKey
                  ? <CiteFigure figureKey={kpi.provenanceKey} compact />
                  : <span className="kpi-source-missing" title={t('provenance.missing', 'No provenance key for this KPI')}>ⓘ</span>}
              </div>
            </ExpandableTile>
          );
        })}
      </div>
      {isMobile && indicators.length > 6 && (
        <button
          type="button"
          className="overview-more-kpis"
          onClick={() => setShowAllIndicators((value) => !value)}
          aria-expanded={showAllIndicators}
        >
          {showAllIndicators
            ? t('overview.showFewer', 'Show fewer indicators')
            : t('overview.showMore', 'Show {count} more indicators')
              .replace('{count}', String(indicators.length - 6))}
        </button>
      )}
      <details
        className="overview-details"
        open={detailsOpen}
        onToggle={(event) => {
          if (event.currentTarget.open !== detailsOpen) {
            setDetailsOpen(event.currentTarget.open);
          }
        }}
      >
        <summary>
          <span>{t('overview.details', 'More context, releases and source details')}</span>
          <small>{t('overview.detailsHint', 'Watchlist, changes, calendar and audit')}</small>
        </summary>
        <div className="overview-details__body">
          <LatestChangesPanel />
          <WatchlistPanel onNavigate={navigate} />
          <SnapshotPanel />
          <ReleaseCalendarSection compact />
          <DataFreshnessPanel />
        </div>
      </details>
    </section>
  );
}
