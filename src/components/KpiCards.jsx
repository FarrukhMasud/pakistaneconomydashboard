import { useEffect, useMemo, useRef, useState } from 'react';
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
import WatchlistFeedback from './WatchlistFeedback';
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
  buildOverviewIndicators,
  kpiRoute,
  overviewFreshness,
  selectHeadlineKpis,
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

function navigate(groupId, sectionId, options) {
  const path = routeToPath(groupId, sectionId, options);
  window.history.pushState(null, '', path);
  window.dispatchEvent(new PopStateEvent('popstate'));
}

export default function KpiCards() {
  const { t, tx } = useI18n();
  const { data, loading, error, retry } = useData('kpi-summary.json');
  const trade = useData('trade.json');
  const remittances = useData('remittances.json');
  const snapshot = useData('indicators.json');
  const freshness = useData('data-freshness.json');
  const { pins, isPinned, toggle } = useWatchlist();
  const { mobile: isMobile, detailsOpen, setDetailsOpen } = useOverviewLayout();
  const [showAllIndicators, setShowAllIndicators] = useState(false);
  const [view, setView] = useState('all');
  const allIndicatorsRef = useRef(null);

  const indicators = useMemo(() => buildOverviewIndicators({
    summary: data, trade: trade.data, remittances: remittances.data, snapshot: snapshot.data,
  }), [data, trade.data, remittances.data, snapshot.data]);
  const dates = overviewFreshness(indicators, freshness.data);

  if (loading) return <LoadingCard label="Loading overview…" />;
  if (error || !data) return <ErrorCard error={error} onRetry={retry} label="Could not load economic overview" />;

  const headlineIndicators = selectHeadlineKpis(indicators);
  const visibleIndicators = isMobile && !showAllIndicators ? headlineIndicators : indicators;
  const extraCount = indicators.length - headlineIndicators.length;

  return (
    <section className="fade-in economic-overview">
      <SectionHeader
        title="Economic Overview"
        description="Key macroeconomic indicators at a glance. These headline numbers summarize Pakistan's economic health — from external accounts (reserves, trade, remittances) to domestic conditions (growth, inflation, monetary policy). Arrows show the direction of change; color reflects whether that movement is favorable, unfavorable, or neutral for the indicator."
        sourceLinks={[
          { label: 'SBP EasyData Portal', url: 'https://easydata.sbp.org.pk' },
          { label: 'PBS Statistics', url: 'https://www.pbs.gov.pk' },
        ]}
      />
      <div className="overview-refreshed">
        <p className="overview-refreshed__dates">
          {(dates.checked || data.lastChecked) && (
            <span>{t('overview.checked', 'Latest source check: {date}').replace('{date}', formatKpiPeriod(dates.checked || data.lastChecked))}</span>
          )}
          {(dates.changed || data.lastUpdated) && (
            <span>{' · '}{t('overview.contentChanged', 'Latest data content change: {date}').replace('{date}', formatKpiPeriod(dates.changed || data.lastUpdated))}</span>
          )}
        </p>
        <details className="overview-source-details">
          <summary>{t('overview.aboutDatesSources', 'About dates & sources')}</summary>
          <div className="overview-source-details__body">
            <p>{t('overview.dateMeaning', 'A source check is not a new observation. Each figure shows its own observation period; source dates are in Details.')}</p>
            <p>{t('overview.sourceMix', 'Official data, dashboard-derived calculations and explicitly attributed secondary reporting are labelled separately.')}</p>
          </div>
        </details>
      </div>
      <div className="overview-selection" role="group" aria-label={t('overview.indicatorView', 'Indicator view')}>
        <button
          ref={allIndicatorsRef}
          type="button"
          aria-pressed={view === 'all'}
          className={`overview-selection__button ${view === 'all' ? 'is-active' : ''}`}
          onClick={() => setView('all')}
        >
          {t('overview.allIndicators', 'All indicators')}
        </button>
        <button
          type="button"
          aria-pressed={view === 'watchlist'}
          className={`overview-selection__button ${view === 'watchlist' ? 'is-active' : ''}`}
          onClick={() => setView('watchlist')}
        >
          {t('overview.myWatchlist', 'My watchlist')} <span aria-hidden="true">({pins.length})</span>
        </button>
      </div>
      <WatchlistFeedback indicators={indicators} />
      {(pins.length > 0 || view === 'watchlist') && (
        <WatchlistPanel
          indicators={indicators}
          onNavigate={navigate}
          onBrowse={() => {
            setView('all');
            allIndicatorsRef.current?.focus();
          }}
        />
      )}
      <div className="overview-all-indicators" hidden={view !== 'all'}>
      {!isMobile && <OverviewBriefing indicators={indicators} onNavigate={navigate} />}
      {!isMobile && <WhatMovedStrip indicators={indicators} onNavigate={navigate} />}
      <p className="overview-legend">{t('overview.legend', 'Teal is favorable, coral is unfavorable, amber is little changed — not simply whether the number rose.')}</p>
      <div className="kpi-grid stagger-children">
        {visibleIndicators.map((kpi) => {
          const label = kpi.labelKey ? t(kpi.labelKey, kpi.label) : tx(kpi.label);
          const sentiment = kpi.sentiment || 'neutral';
          const color = sentimentColor(sentiment);
          const changeLabel = formatKpiChange(kpi, t);
          const compareBasis = formatCompareBasis(kpi.changeBasis);
          const pinned = isPinned(kpi.id);
          const route = kpiRoute(kpi.id);
          const sourceDates = dates.datasets.get(route.datasetId);
          return (
            <div
              key={kpi.id}
              className="kpi-card-hit"
            >
              <ExpandableTile
                className={`card kpi-card sentiment-${sentiment}`}
                title={label}
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
                        <strong>{kpi.momChangeLabel}{kpi.momChangeBasis ? ` ${formatCompareBasis(kpi.momChangeBasis)}` : ''}</strong>
                      </div>
                    )}
                    {kpi.momComparison && (
                      <div className="tile-detail-row">
                        <span>{t('overview.monthOnMonth', 'Month-on-month')}</span>
                        <strong>{formatKpiChange(kpi.momComparison, t)} {formatCompareBasis(kpi.momComparison.changeBasis)}</strong>
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
                    {sourceDates?.verificationDate && (
                      <div className="tile-detail-row">
                        <span>{t('overview.sourceChecked', 'Source checked')}</span>
                        <strong>{formatKpiPeriod(sourceDates.verificationDate)}</strong>
                      </div>
                    )}
                    {sourceDates?.dashboardUpdated && (
                      <div className="tile-detail-row">
                        <span>{t('overview.dataChanged', 'Data content changed')}</span>
                        <strong>{formatKpiPeriod(sourceDates.dashboardUpdated)}</strong>
                      </div>
                    )}
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
                    aria-label={(pinned
                      ? t('watchlist.unpinNamed', 'Unpin {label}')
                      : t('watchlist.pinNamed', 'Pin {label} to watchlist')).replace('{label}', label)}
                    title={pinned ? t('watchlist.unpin', 'Unpin') : t('watchlist.pin', 'Pin to watchlist')}
                    onClick={() => toggle(kpi.id)}
                  >
                    {pinned ? '★' : '☆'}
                  </button>
                </div>
                <a
                  className="kpi-section-link"
                  href={routeToPath(route.groupId, route.sectionId)}
                  onClick={(event) => {
                    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
                    event.preventDefault();
                    navigate(route.groupId, route.sectionId);
                  }}
                >
                <div className="kpi-label">{label}</div>
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
                  <span className="kpi-change-value">{trendArrow(kpi.trend)} {changeLabel ?? 'n/a'}</span>
                  {compareBasis && <span className="kpi-change-basis">{compareBasis}</span>}
                </div>
                <span className="kpi-open-section">{t('overview.openSection', 'Open section')} →</span>
                </a>
                <div className="kpi-source">
                  <span className="kpi-source-label">{tx('Source')}: {kpi.source}</span>
                  {kpi.provenanceKey
                    ? <CiteFigure figureKey={kpi.provenanceKey} compact />
                    : <span className="kpi-source-missing" title={t('provenance.missing', 'No provenance key for this KPI')}>ⓘ</span>}
                </div>
              </ExpandableTile>
            </div>
          );
        })}
      </div>
      {isMobile && extraCount > 0 && (
        <button
          type="button"
          className="overview-more-kpis"
          onClick={() => setShowAllIndicators((value) => !value)}
          aria-expanded={showAllIndicators}
        >
          {showAllIndicators
            ? t('overview.showFewer', 'Show fewer indicators')
            : t('overview.showMore', 'Show {count} more indicators')
              .replace('{count}', String(extraCount))}
        </button>
      )}
      {isMobile && <OverviewBriefing indicators={indicators} onNavigate={navigate} />}
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
          <small>{t('overview.contextHint', 'Latest data changes and source context')}</small>
        </summary>
        <div className="overview-details__body">
          <LatestChangesPanel />
          <SnapshotPanel />
        </div>
      </details>
      </div>
    </section>
  );
}
