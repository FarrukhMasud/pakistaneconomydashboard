import { useMemo } from 'react';
import useI18n from '../i18n/useI18n';
import { COLORS } from '../utils/chartConfig';
import { formatCompareBasis, formatKpiChange, formatKpiDisplay, formatKpiPeriod } from '../utils/kpiFormat';
import { kpiRoute } from '../utils/overviewModel';
import { routeToPath } from '../hooks/useHashRoute';
import { isClosedFiscalPeriod } from '../utils/periodHelpers';

const CRITICAL = [
  { id: 'reserves', label: 'Reserves' },
  { id: 'inflation', label: 'CPI' },
  { id: 'fbr-tax', label: 'FBR' },
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
export default function WhatMovedStrip({ indicators = [], onNavigate }) {
  const { t, tx } = useI18n();
  const moves = useMemo(() => {
    const byId = Object.fromEntries(indicators.map((row) => [row.id, row]));

    return CRITICAL.map((spec) => {
      const row = byId[spec.id];
      if (!row) return null;
      const route = kpiRoute(row.id);
      return {
        id: row.id,
        label: spec.id === 'fbr-tax'
          ? isClosedFiscalPeriod(row.period)
            ? t('overview.fbrFullYear', 'FBR full year')
            : t('overview.fbrYtd', 'FBR fiscal year to date')
          : tx(spec.label),
        value: formatKpiDisplay(row),
        period: formatKpiPeriod(row.period),
        changeLabel: formatKpiChange(row, t),
        secondary: formatCompareBasis(row.changeBasis),
        trend: row.trend || 'flat',
        sentiment: row.sentiment || 'neutral',
        groupId: route.groupId,
        sectionId: route.sectionId,
      };
    }).filter(Boolean);
  }, [indicators, t, tx]);

  if (!moves.length) return null;

  return (
    <section className="what-moved overview-desktop-context" aria-label={t('overview.whatMoved', 'What moved')}>
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
            <a
              key={move.id}
              className={`what-moved__card sentiment-${move.sentiment}`}
              href={routeToPath(move.groupId, move.sectionId)}
              onClick={(event) => {
                if (!onNavigate || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) return;
                event.preventDefault();
                onNavigate(move.groupId, move.sectionId);
              }}
            >
              <span className="what-moved__label">{move.label}</span>
              <strong className="what-moved__value" style={{ color }}>{move.value}</strong>
              <span className="what-moved__period">{move.period}</span>
              <span className={`what-moved__change ${move.sentiment}`}>
                {arrow(move.trend)} {move.changeLabel || '—'}
              </span>
              {move.secondary && (
                <span className="what-moved__basis">{tx(move.secondary)}</span>
              )}
            </a>
          );
        })}
      </div>
    </section>
  );
}
