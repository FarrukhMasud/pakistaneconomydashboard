import { useEffect, useMemo, useState } from 'react';
import { useData } from '../hooks/useData';
import { useWatchlist } from '../hooks/useWatchlist';
import { COLORS } from '../utils/chartConfig';
import SectionHeader from './SectionHeader';
import SnapshotPanel from './SnapshotPanel';
import CiteFigure from './CiteFigure';
import WhatMovedStrip from './WhatMovedStrip';
import OverviewBriefing from './OverviewBriefing';
import LatestChangesPanel from './LatestChangesPanel';
import WatchlistPanel from './WatchlistPanel';
import SourceBadge from './SourceBadge';
import ExpandableTile from './ui/ExpandableTile';
import AnimatedNumber from './ui/AnimatedNumber';
import { LoadingCard, ErrorCard } from './ui/DataState';
import useI18n from '../i18n/useI18n';
import { routeToPath } from '../hooks/useHashRoute';
import {
  formatCompareBasis,
  formatKpiChange,
  formatKpiNumber,
  formatKpiPeriod,
  formatKpiUnit,
  getKpiDecimals,
  isProvisionalPeriod,
} from '../utils/kpiFormat';
import {
  buildSnapshotKpi,
  buildTradeKpi,
  decorateOverviewKpis,
  kpiRoute,
  mergeOverviewIndicators,
} from '../utils/overviewModel';

function useOverviewLayout() {
  const [layout, setLayout] = useState(() => {
    const mobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 720px)').matches;
    return { mobile, detailsOpen: false };
  });

  useEffect(() => {
    const query = window.matchMedia('(max-width: 720px)');
    const update = (event) => {
      setLayout((current) => ({ ...current, mobile: event.matches }));
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

function navigate(groupId, sectionId) {
  const path = routeToPath(groupId, sectionId);
  window.history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export default function KpiCards() {
  const { t, tx } = useI18n();
  const { data, loading, error, retry } = useData('kpi-summary.json');
  const trade = useData('trade.json');
  const remittances = useData('remittances.json');
  const snapshot = useData('indicators.json');
  const { isPinned, toggle } = useWatchlist();
  const { mobile: isMobile, detailsOpen, setDetailsOpen } = useOverviewLayout();
  const [showAllIndicators, setShowAllIndicators] = useState(false);

  const indicators = useMemo(() => {
    const extras = [
      buildTradeKpi(trade.data),
      buildSnapshotKpi(snapshot.data?.indicators?.find((row) => row.id === 'current-account')),
      buildSnapshotKpi(snapshot.data?.indicators?.find((row) => row.id === 'public-debt')),
      buildSnapshotKpi(snapshot.data?.indicators?.find((row) => row.id === 'circular-debt')),
    ];
    return decorateOverviewKpis(
      mergeOverviewIndicators(data?.indicators, extras),
      { remittances: remittances.data },
    );
  }, [data, trade.data, remittances.data, snapshot.data]);

  if (loading) return <LoadingCard label="Loading overview…" />;
  if (error || !data) return <ErrorCard error={error} onRetry={retry} label="Could not load economic overview" />;

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
      <p className="overview-refreshed">
        {t('overview.refreshed', 'Data refreshed {date} · Official sources only')
          .replace('{date}', formatKpiPeriod(data.lastUpdated))}
      </p>
      <OverviewBriefing onNavigate={navigate} />
      <WhatMovedStrip onNavigate={navigate} />
      <p className="overview-legend">{t('overview.legend', 'Teal is favorable, coral is unfavorable, amber is little changed — not simply whether the number rose.')}</p>
      <div className="kpi-grid stagger-children">
        {visibleIndicators.map((kpi) => {
          const sentiment = kpi.sentiment || 'neutral';
          const color = sentimentColor(sentiment);
          const changeLabel = formatKpiChange(kpi);
          const compareBasis = formatCompareBasis(kpi.changeBasis);
          const pinned = isPinned(kpi.id);
          const route = kpiRoute(kpi.id);
          const openSection = () => navigate(route.groupId, route.sectionId);
          return (
            <div
              key={kpi.id}
              className="kpi-card-hit"
              onClick={(event) => {
                if (event.target.closest('button, a')) return;
                openSection();
              }}
            >
              <ExpandableTile
                className={`card kpi-card kpi-card--link sentiment-${sentiment}`}
                title={kpi.label}
                subtitle={`${formatKpiPeriod(kpi.period)} · Source: ${kpi.source}`}
                details={(
                  <div className="tile-detail-list">
                    <div className="tile-detail-row">
                      <span>{tx('Latest value')}</span>
                      <strong style={{ color }}>
                        {kpi.displayValue || `${formatKpiNumber(kpi)} ${formatKpiUnit(kpi.unit)}`.trim()}
                      </strong>
                    </div>
                    <div className="tile-detail-row">
                      <span>{tx('Period')}</span>
                      <strong>{formatKpiPeriod(kpi.period)}</strong>
                    </div>
                    <div className="tile-detail-row">
                      <span>{tx('Change')}</span>
                      <strong>{trendArrow(kpi.trend)} {changeLabel ?? 'n/a'}</strong>
                    </div>
                    {compareBasis && (
                      <div className="tile-detail-row">
                        <span>{tx('Compared with')}</span>
                        <strong>{compareBasis}</strong>
                      </div>
                    )}
                    {kpi.momChangeLabel && (
                      <div className="tile-detail-row">
                        <span>{t('overview.monthOnMonth', 'Month-on-month')}</span>
                        <strong>{kpi.momChangeLabel}</strong>
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
                    <div className="tile-detail-row">
                      <span>{t('overview.section', 'Section')}</span>
                      <a href={routeToPath(route.groupId, route.sectionId)}>{t('overview.openSection', 'Open section')}</a>
                    </div>
                  </div>
                )}
              >
                <div className="kpi-label-row">
                  <div className="kpi-label-meta">
                    <div className="kpi-label">{kpi.label}</div>
                    <SourceBadge
                      datasetId={route.datasetId}
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
                    <>
                      <AnimatedNumber
                        value={kpi.value}
                        decimals={getKpiDecimals(kpi)}
                      />
                      {' '}
                      <span className="kpi-unit">{formatKpiUnit(kpi.unit)}</span>
                    </>
                  ) : (
                    <span>{kpi.displayValue || formatKpiNumber(kpi)}</span>
                  )}
                </div>
                <div className="kpi-period">
                  {formatKpiPeriod(kpi.period)}
                  {isProvisionalPeriod(kpi.period) && <span className="provisional-badge">{tx('Provisional')}</span>}
                </div>
                {kpi.sub && <div className="kpi-sub">{kpi.sub}</div>}
                <div className={`kpi-trend ${sentiment}`} title={compareBasis || undefined}>
                  {trendArrow(kpi.trend)} {changeLabel ?? 'n/a'}
                  {compareBasis && <span className="kpi-change-basis"> {compareBasis}</span>}
                </div>
                <div className="kpi-source">
                  Source: {kpi.source}
                  {kpi.provenanceKey
                    ? <CiteFigure figureKey={kpi.provenanceKey} compact />
                    : <span className="kpi-source-missing" title={t('provenance.missing', 'No provenance key for this KPI')}>ⓘ</span>}
                </div>
                <span className="kpi-open-section">{t('overview.openSection', 'Open section')} →</span>
              </ExpandableTile>
            </div>
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
          <small>{t('overview.detailsHint', 'Watchlist and latest data changes')}</small>
        </summary>
        <div className="overview-details__body">
          <LatestChangesPanel />
          <WatchlistPanel onNavigate={navigate} />
          <SnapshotPanel />
        </div>
      </details>
    </section>
  );
}
