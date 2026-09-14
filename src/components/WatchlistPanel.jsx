import { useWatchlist } from '../hooks/useWatchlist';
import useI18n from '../i18n/useI18n';
import { COLORS } from '../utils/chartConfig';
import CiteFigure from './CiteFigure';
import SourceBadge from './SourceBadge';
import { routeToPath } from '../hooks/useHashRoute';
import { resolveWatchlistItems } from '../utils/watchlistModel';

/**
 * Pinned indicators on Overview (localStorage). Empty state explains how to pin.
 */
export default function WatchlistPanel({ indicators = [], onNavigate, onBrowse }) {
  const { t, tx } = useI18n();
  const { pins, unpin, clear } = useWatchlist();
  const items = resolveWatchlistItems(pins, indicators);

  if (!pins.length) {
    return (
      <section className="watchlist watchlist--empty" aria-label={t('watchlist.title', 'Watchlist')}>
        <h3>{t('watchlist.title', 'Your watchlist')}</h3>
        <p>
          {t(
            'watchlist.emptyHint',
            'Choose All indicators and use a star to save the figures you follow. You can also pin sections from Search. Pins stay on this device.',
          )}
        </p>
        {onBrowse && (
          <button type="button" className="watchlist__browse" onClick={onBrowse}>
            {t('watchlist.browse', 'Browse indicators')}
          </button>
        )}
      </section>
    );
  }

  return (
    <section className="watchlist" aria-label={t('watchlist.title', 'Watchlist')}>
      <div className="watchlist__head">
        <h3>{t('watchlist.title', 'Your watchlist')}</h3>
        <button type="button" className="watchlist__clear" onClick={clear}>
          {t('watchlist.clear', 'Clear all')}
        </button>
      </div>
      <div className="watchlist__grid">
        {items.map((item) => {
          const label = item.labelKey ? t(item.labelKey, item.label) : item.label ? tx(item.label) : t('watchlist.indicator', 'Indicator');
          const color = item.sentiment === 'positive'
            ? COLORS.teal
            : item.sentiment === 'negative'
              ? COLORS.coral
              : undefined;
          return (
            <div key={item.id} className="watchlist__card">
              {item.kind === 'unknown' ? (
                <div className="watchlist__open">
                  <span className="watchlist__label">{t('watchlist.unavailable', 'Saved indicator unavailable')}</span>
                  <span>{t('watchlist.unavailableHint', 'Remove this pin and choose an indicator from All indicators or Search.')}</span>
                </div>
              ) : (
                <a
                  className="watchlist__open"
                  href={routeToPath(item.groupId, item.sectionId, { chartId: item.chartId })}
                  onClick={(event) => {
                    if (!onNavigate || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
                    event.preventDefault();
                    onNavigate(item.groupId, item.sectionId, { chartId: item.chartId });
                  }}
                >
                <span className="watchlist__label">{label}</span>
                {item.value != null && (
                  <strong style={color ? { color } : undefined}>{item.value}</strong>
                )}
                {item.period && <span className="watchlist__period">{item.period}</span>}
                {item.source && <span className="watchlist__period watchlist__source">{tx('Source')}: {item.source}</span>}
                {item.value == null && (
                  <span className="watchlist__period">
                    {item.kind === 'catalog'
                      ? t('watchlist.exploreSection', 'Explore this section')
                      : t('watchlist.valueUnavailable', 'Value unavailable - open the section for source details')}
                  </span>
                )}
                </a>
              )}
              <div className="watchlist__actions">
                <SourceBadge datasetId={item.datasetId} sourceType={item.sourceType} compact />
                {item.provenanceKey && <CiteFigure figureKey={item.provenanceKey} compact />}
                <button
                  type="button"
                  className="watchlist__unpin"
                  onClick={() => unpin(item.id)}
                  aria-label={t('watchlist.unpinNamed', 'Unpin {label}').replace('{label}', label)}
                  title={t('watchlist.unpin', 'Unpin')}
                >
                  ★
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
