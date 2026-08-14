import { useMemo } from 'react';
import { useData } from '../hooks/useData';
import useI18n from '../i18n/useI18n';
import { COLORS } from '../utils/chartConfig';
import { formatCompareBasis, formatKpiChange, formatKpiDisplay, formatKpiPeriod } from '../utils/kpiFormat';
import { buildTradeKpi, decorateOverviewKpis, kpiRoute } from '../utils/overviewModel';

const CRITICAL = [
  { id: 'reserves', label: 'Reserves' },
  { id: 'inflation', label: 'CPI' },
  { id: 'fbr-tax', label: 'FBR FYTD' },
  { id: 'trade', label: 'Trade balance' },
  { id: 'remittances', label: 'Remittances' },
];

function arrow(trend) {
  if (trend === 'up') return '▲';
  if (trend === 'down') return '▼';
  return '►';
}

/**
 * Compact “what moved” strip for Overview — five critical series with last change.
 */
export default function WhatMovedStrip({ onNavigate }) {
  const { t, tx } = useI18n();
  const kpi = useData('kpi-summary.json');
  const trade = useData('trade.json');
  const remittances = useData('remittances.json');

  const moves = useMemo(() => {
    const decorated = decorateOverviewKpis(kpi.data?.indicators || [], { remittances: remittances.data });
    const byId = Object.fromEntries(decorated.map((row) => [row.id, row]));
    const tradeKpi = buildTradeKpi(trade.data);

    return CRITICAL.map((spec) => {
      const row = spec.id === 'trade' ? tradeKpi : byId[spec.id];
      if (!row) return null;
      const route = kpiRoute(row.id);
      return {
        id: row.id,
        label: spec.label,
        value: formatKpiDisplay(row),
        period: formatKpiPeriod(row.period),
        changeLabel: formatKpiChange(row),
        secondary: row.momChangeLabel || formatCompareBasis(row.changeBasis),
        trend: row.trend || 'flat',
        sentiment: row.sentiment || 'neutral',
        groupId: route.groupId,
        sectionId: route.sectionId,
      };
    }).filter(Boolean);
  }, [kpi.data, trade.data, remittances.data]);

  if (kpi.loading && !kpi.data) return null;
  if (!moves.length) return null;

  return (
    <section className="what-moved" aria-label={t('overview.whatMoved', 'What moved')}>
      <div className="what-moved__head">
        <h3>{t('overview.whatMoved', 'What moved')}</h3>
        <p>{t('overview.whatMovedHint', 'Latest move for five critical series. Seasonal series show the year-on-year change.')}</p>
      </div>
      <div className="what-moved__grid">
        {moves.map((move) => {
          const color = move.sentiment === 'positive'
            ? COLORS.teal
            : move.sentiment === 'negative'
              ? COLORS.coral
              : COLORS.amber;
          return (
            <button
              key={move.id}
              type="button"
              className={`what-moved__card sentiment-${move.sentiment}`}
              onClick={() => onNavigate?.(move.groupId, move.sectionId)}
            >
              <span className="what-moved__label">{tx(move.label)}</span>
              <strong className="what-moved__value" style={{ color }}>{move.value}</strong>
              <span className="what-moved__period">{move.period}</span>
              <span className={`what-moved__change ${move.sentiment}`}>
                {arrow(move.trend)} {move.changeLabel || '—'}
              </span>
              {move.secondary && (
                <span className="what-moved__basis">{tx(move.secondary)}</span>
              )}
            </button>
          );
        })}
      </div>
    </section>
  );
}
