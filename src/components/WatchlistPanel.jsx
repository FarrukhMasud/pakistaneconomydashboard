import { useMemo } from 'react';
import { useData } from '../hooks/useData';
import { useWatchlist } from '../hooks/useWatchlist';
import useI18n from '../i18n/useI18n';
import { INDICATOR_CATALOG } from '../utils/indicatorCatalog';
import { COLORS } from '../utils/chartConfig';
import CiteFigure from './CiteFigure';

function formatValue(kpi) {
  if (!Number.isFinite(kpi?.value)) return String(kpi?.value ?? '—');
  return Number.isFinite(kpi.decimals) ? kpi.value.toFixed(kpi.decimals) : String(kpi.value);
}

/**
 * Pinned indicators on Overview (localStorage). Empty state explains how to pin.
 */
export default function WatchlistPanel({ onNavigate }) {
  const { t, tx } = useI18n();
  const { pins, toggle, clear } = useWatchlist();
  const kpi = useData('kpi-summary.json');

  const items = useMemo(() => {
    const indicators = kpi.data?.indicators || [];
    const byId = Object.fromEntries(indicators.map((row) => [row.id, row]));
    const byCatalog = Object.fromEntries(INDICATOR_CATALOG.map((row) => [row.id, row]));

    return pins.map((id) => {
      const kpiRow = byId[id];
      if (kpiRow) {
        return {
          id,
          kind: 'kpi',
          label: kpiRow.label,
          value: `${formatValue(kpiRow)}${kpiRow.unit || ''}`,
          period: kpiRow.period,
          sentiment: kpiRow.sentiment || 'neutral',
          provenanceKey: kpiRow.provenanceKey,
          groupId: resolveGroup(kpiRow.id),
          sectionId: resolveSection(kpiRow.id),
        };
      }
      const cat = byCatalog[id];
      if (cat) {
        return {
          id,
          kind: 'catalog',
          label: cat.label,
          value: null,
          period: null,
          sentiment: 'neutral',
          groupId: cat.groupId,
          sectionId: cat.sectionId,
        };
      }
      return {
        id,
        kind: 'unknown',
        label: id,
        value: null,
        period: null,
        sentiment: 'neutral',
        groupId: 'overview',
        sectionId: 'overview',
      };
    });
  }, [pins, kpi.data]);

  if (!pins.length) {
    return (
      <section className="watchlist watchlist--empty" aria-label={t('watchlist.title', 'Watchlist')}>
        <h3>{t('watchlist.title', 'Your watchlist')}</h3>
        <p>
          {t(
            'watchlist.empty',
            'Pin KPIs with the ★ button, or pin indicators from the command palette (Ctrl/Cmd+K). Pins stay on this device.',
          )}
        </p>
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
          const color = item.sentiment === 'positive'
            ? COLORS.teal
            : item.sentiment === 'negative'
              ? COLORS.coral
              : undefined;
          return (
            <div key={item.id} className="watchlist__card">
              <button
                type="button"
                className="watchlist__open"
                onClick={() => onNavigate?.(item.groupId, item.sectionId)}
              >
                <span className="watchlist__label">{tx(item.label)}</span>
                {item.value != null && (
                  <strong style={color ? { color } : undefined}>{item.value}</strong>
                )}
                {item.period && <span className="watchlist__period">{item.period}</span>}
              </button>
              <div className="watchlist__actions">
                {item.provenanceKey && <CiteFigure figureKey={item.provenanceKey} compact />}
                <button
                  type="button"
                  className="watchlist__unpin"
                  onClick={() => toggle(item.id)}
                  aria-label={t('watchlist.unpin', 'Unpin')}
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

function resolveGroup(kpiId) {
  const map = {
    reserves: 'external',
    'exchange-rate': 'external',
    remittances: 'external',
    fdi: 'external',
    it_exports: 'external',
    inflation: 'prices',
    'policy-rate': 'prices',
    'gdp-growth': 'fiscal',
    'fbr-tax': 'fiscal',
  };
  return map[kpiId] || 'overview';
}

function resolveSection(kpiId) {
  const map = {
    reserves: 'reserves',
    'exchange-rate': 'exchange',
    remittances: 'remittances',
    fdi: 'fdi',
    it_exports: 'services',
    inflation: 'inflation',
    'policy-rate': 'monetary',
    'gdp-growth': 'fiscal',
    'fbr-tax': 'fbr',
  };
  return map[kpiId] || 'overview';
}
