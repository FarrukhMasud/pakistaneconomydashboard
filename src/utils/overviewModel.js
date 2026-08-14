import { formatKpiPeriod, formatKpiChange } from './kpiFormat.js';
import { isFiniteNumber, latestRow, pctChange } from './periodHelpers.js';

export const KPI_ROUTES = {
  reserves: { groupId: 'external', sectionId: 'reserves', datasetId: 'reserves' },
  'exchange-rate': { groupId: 'external', sectionId: 'exchange', datasetId: 'exchange-rates' },
  remittances: { groupId: 'external', sectionId: 'remittances', datasetId: 'remittances' },
  fdi: { groupId: 'external', sectionId: 'fdi', datasetId: 'fdi' },
  it_exports: { groupId: 'external', sectionId: 'services', datasetId: 'services' },
  'gdp-growth': { groupId: 'fiscal', sectionId: 'fiscal', datasetId: 'fiscal' },
  inflation: { groupId: 'prices', sectionId: 'inflation', datasetId: 'inflation' },
  'fbr-tax': { groupId: 'fiscal', sectionId: 'fbr', datasetId: 'fbr-tax' },
  'policy-rate': { groupId: 'prices', sectionId: 'monetary', datasetId: 'monetary-policy' },
  trade: { groupId: 'external', sectionId: 'trade', datasetId: 'trade' },
  'current-account': { groupId: 'external', sectionId: 'trade', datasetId: 'indicators' },
  'public-debt': { groupId: 'fiscal', sectionId: 'fiscal', datasetId: 'indicators' },
  'circular-debt': { groupId: 'insights', sectionId: 'macro-risk', datasetId: 'circular-debt' },
};

export function kpiRoute(id) {
  return KPI_ROUTES[id] || { groupId: 'overview', sectionId: 'overview', datasetId: undefined };
}

export function yoyMatch(rows, date) {
  if (!date || !Array.isArray(rows)) return null;
  const [year, month] = String(date).split('-');
  if (!year || !month) return null;
  return rows.find((row) => row.date === `${Number(year) - 1}-${month}`) || null;
}

export function applyYoYHeadline(kpi, rows, { valueKey = 'total', goodWhenUp = true } = {}) {
  const latest = latestRow(rows);
  const prior = yoyMatch(rows, latest?.date);
  const current = latest?.[valueKey];
  const yearAgo = prior?.[valueKey];
  if (!isFiniteNumber(current) || !isFiniteNumber(yearAgo)) return kpi;

  const move = pctChange(current, yearAgo);
  if (move.pct == null) return kpi;

  const sentiment = move.direction === 'flat'
    ? 'neutral'
    : (move.direction === 'up') === goodWhenUp ? 'positive' : 'negative';

  return {
    ...kpi,
    momChangeLabel: formatKpiChange(kpi),
    change: move.pct,
    changeUnit: '%',
    changeBasis: `vs ${formatKpiPeriod(prior.date)} (YoY)`,
    trend: move.direction === 'flat' ? 'stable' : move.direction,
    sentiment,
    headlineKind: 'yoy',
  };
}

export function buildTradeKpi(trade) {
  const latest = latestRow(trade?.monthly);
  if (!latest || !isFiniteNumber(latest.balance)) return null;
  const yearAgo = yoyMatch(trade.monthly, latest.date);
  const yoy = yearAgo && isFiniteNumber(yearAgo.balance)
    ? pctChange(latest.balance, yearAgo.balance)
    : null;
  const prior = trade.monthly.length > 1 ? trade.monthly.at(-2) : null;
  const mom = prior && isFiniteNumber(prior.balance) ? pctChange(latest.balance, prior.balance) : null;

  return {
    id: 'trade',
    label: 'Trade Balance (Monthly)',
    value: latest.balance / 1000,
    decimals: 2,
    unit: 'USD bn',
    period: latest.date,
    change: yoy?.pct,
    changeUnit: yoy?.pct != null ? '%' : undefined,
    changeBasis: yearAgo ? `vs ${formatKpiPeriod(yearAgo.date)} (YoY)` : null,
    momChangeLabel: mom?.pct != null ? `${mom.pct > 0 ? '+' : ''}${mom.pct}% MoM` : null,
    trend: (yoy?.direction || mom?.direction || 'flat') === 'flat'
      ? 'stable'
      : (yoy?.direction || mom?.direction),
    sentiment: latest.balance >= 0 ? 'positive' : 'negative',
    source: 'SBP',
    sub: `Exports ${(latest.exports / 1000).toFixed(2)} USD bn · Imports ${(latest.imports / 1000).toFixed(2)} USD bn`,
  };
}

export function buildSnapshotKpi(row) {
  if (!row?.id) return null;
  return {
    id: row.id,
    label: row.label,
    displayValue: `${row.value}${row.unit ? ` ${row.unit}` : ''}`.trim(),
    period: row.asOf,
    changeLabel: row.change || null,
    changeBasis: row.note || null,
    trend: row.trend || 'stable',
    sentiment: row.sentiment || 'neutral',
    source: row.source,
    sourceUrl: row.sourceUrl,
    sub: row.note,
  };
}

export function mergeOverviewIndicators(summaryIndicators, extras = []) {
  const seen = new Set();
  const out = [];
  for (const row of [...(summaryIndicators || []), ...extras]) {
    if (!row?.id || seen.has(row.id)) continue;
    seen.add(row.id);
    out.push(row);
  }
  return out;
}

export function decorateOverviewKpis(indicators, { remittances } = {}) {
  return (indicators || []).map((kpi) => {
    if (kpi.id === 'remittances' && remittances?.monthly) {
      return applyYoYHeadline(kpi, remittances.monthly, { valueKey: 'total', goodWhenUp: true });
    }
    return kpi;
  });
}

function signedAbs(value, digits = 1) {
  const abs = Math.abs(value).toLocaleString(undefined, {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
  return abs;
}

/**
 * Rule-based briefing clauses from already-decorated KPIs + optional FBR gap.
 * Callers translate via t(clause.key, clause.fallback).replace('{value}', clause.value).
 */
export function buildOverviewClauses({ inflation, remittances, trade, fbrGap, fbrGapUnit = 'Rs bn' } = {}) {
  const clauses = [];

  if (Number.isFinite(inflation?.value)) {
    const delta = inflation.change;
    const key = delta < 0
      ? 'overview.clause.inflationCooled'
      : delta > 0
        ? 'overview.clause.inflationRose'
        : 'overview.clause.inflationHeld';
    const verb = delta < 0 ? 'cooled to' : delta > 0 ? 'rose to' : 'held at';
    clauses.push({
      id: 'inflation',
      key,
      fallback: `Inflation ${verb} {value}%`,
      value: String(inflation.value),
    });
  }

  if (Number.isFinite(remittances?.change) && remittances.headlineKind === 'yoy') {
    const key = remittances.change > 0.5
      ? 'overview.clause.remittancesUp'
      : remittances.change < -0.5
        ? 'overview.clause.remittancesDown'
        : 'overview.clause.remittancesFlat';
    const fallback = remittances.change > 0.5
      ? 'remittances are {value}% higher than a year earlier'
      : remittances.change < -0.5
        ? 'remittances are {value}% lower than a year earlier'
        : 'remittances are little changed from a year earlier';
    clauses.push({
      id: 'remittances',
      key,
      fallback,
      value: signedAbs(remittances.change),
    });
  }

  if (Number.isFinite(trade?.value)) {
    const deficit = trade.value < 0;
    clauses.push({
      id: 'trade',
      key: deficit ? 'overview.clause.tradeDeficit' : 'overview.clause.tradeSurplus',
      fallback: deficit
        ? 'the latest monthly goods deficit is {value} USD bn'
        : 'the latest monthly goods surplus is {value} USD bn',
      value: signedAbs(trade.value, 2),
    });
  }

  if (Number.isFinite(fbrGap)) {
    const ahead = fbrGap >= 0;
    clauses.push({
      id: 'fbr',
      key: ahead ? 'overview.clause.fbrAhead' : 'overview.clause.fbrShort',
      fallback: ahead
        ? 'FBR is {value} ahead of its FYTD target'
        : 'FBR is {value} short of its FYTD target',
      value: `${signedAbs(fbrGap, 0)} ${fbrGapUnit}`,
    });
  }

  return clauses;
}

export function joinClauses(parts) {
  const clean = (parts || []).map((part) => String(part || '').trim()).filter(Boolean);
  if (!clean.length) return '';
  if (clean.length === 1) return `${clean[0]}.`;
  const head = clean[0].charAt(0).toUpperCase() + clean[0].slice(1);
  if (clean.length === 2) return `${head}; ${clean[1]}.`;
  return `${head}; ${clean.slice(1, -1).join('; ')}; ${clean.at(-1)}.`;
}
