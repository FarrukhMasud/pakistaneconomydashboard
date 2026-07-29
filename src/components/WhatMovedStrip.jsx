import { useMemo } from 'react';
import { useData } from '../hooks/useData';
import useI18n from '../i18n/useI18n';
import { COLORS } from '../utils/chartConfig';
import { formatMonthYear, formatDayMonthYear, pctChange, isFiniteNumber } from '../utils/periodHelpers';

const CRITICAL = [
  { id: 'reserves', label: 'Reserves', groupId: 'external', sectionId: 'reserves', goodWhenUp: true },
  { id: 'inflation', label: 'CPI', groupId: 'prices', sectionId: 'inflation', goodWhenUp: false },
  { id: 'fbr-tax', label: 'FBR FYTD', groupId: 'fiscal', sectionId: 'fbr', goodWhenUp: true },
  { id: 'trade', label: 'Trade balance', groupId: 'external', sectionId: 'trade', goodWhenUp: true },
  { id: 'remittances', label: 'Remittances', groupId: 'external', sectionId: 'remittances', goodWhenUp: true },
];

function formatPeriod(period) {
  if (!period) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) return formatDayMonthYear(period);
  if (/^\d{4}-\d{2}$/.test(period)) return formatMonthYear(period);
  return period;
}

function arrow(trend) {
  if (trend === 'up') return '▲';
  if (trend === 'down') return '▼';
  return '►';
}

function formatChange(kpi) {
  if (!isFiniteNumber(kpi?.change)) return null;
  const sign = kpi.change > 0 ? '+' : '';
  const unit = kpi.changeUnit || '';
  if (unit === '%' || unit === 'pp') return `${sign}${kpi.change}${unit}`;
  if (unit) return `${sign}${kpi.change} ${unit}`;
  return `${sign}${kpi.change}`;
}

function buildTradeMove(trade) {
  const monthly = trade?.monthly;
  if (!monthly?.length) return null;
  const latest = monthly.at(-1);
  const prior = monthly.at(-2);
  if (!latest || latest.balance == null) return null;
  const mom = prior?.balance != null ? pctChange(latest.balance, prior.balance) : null;
  const yoyDate = `${Number(latest.date.slice(0, 4)) - 1}${latest.date.slice(4)}`;
  const yearAgo = monthly.find((row) => row.date === yoyDate);
  const yoy = yearAgo?.balance != null ? pctChange(latest.balance, yearAgo.balance) : null;
  const sentiment = latest.balance >= 0 ? 'positive' : 'negative';
  return {
    id: 'trade',
    label: 'Trade balance',
    value: `$${(latest.balance / 1000).toFixed(2)}B`,
    period: formatMonthYear(latest.date),
    changeLabel: mom?.pct != null ? `${mom.pct > 0 ? '+' : ''}${mom.pct}% MoM` : null,
    secondary: yoy?.pct != null ? `${yoy.pct > 0 ? '+' : ''}${yoy.pct}% YoY` : null,
    trend: mom?.direction || 'flat',
    sentiment,
    groupId: 'external',
    sectionId: 'trade',
  };
}

/**
 * Compact “what moved” strip for Overview — five critical series with last change.
 */
export default function WhatMovedStrip({ onNavigate }) {
  const { t, tx } = useI18n();
  const kpi = useData('kpi-summary.json');
  const trade = useData('trade.json');

  const moves = useMemo(() => {
    const byId = Object.fromEntries((kpi.data?.indicators || []).map((row) => [row.id, row]));
    const tradeMove = buildTradeMove(trade.data);

    return CRITICAL.map((spec) => {
      if (spec.id === 'trade') return tradeMove;
      const row = byId[spec.id];
      if (!row) return null;
      const changeLabel = formatChange(row);
      return {
        id: row.id,
        label: spec.label,
        value: `${Number.isFinite(row.value)
          ? (Number.isFinite(row.decimals) ? row.value.toFixed(row.decimals) : String(row.value))
          : '—'}${row.unit ? ` ${row.unit}` : ''}`,
        period: formatPeriod(row.period),
        changeLabel: changeLabel ? `${changeLabel}` : null,
        secondary: row.changeBasis || null,
        trend: row.trend || 'flat',
        sentiment: row.sentiment || 'neutral',
        groupId: spec.groupId,
        sectionId: spec.sectionId,
      };
    }).filter(Boolean);
  }, [kpi.data, trade.data]);

  if (kpi.loading && !kpi.data) return null;
  if (!moves.length) return null;

  return (
    <section className="what-moved" aria-label={t('overview.whatMoved', 'What moved')}>
      <div className="what-moved__head">
        <h3>{t('overview.whatMoved', 'What moved')}</h3>
        <p>{t('overview.whatMovedHint', 'Latest observation vs prior period for five critical series.')}</p>
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
