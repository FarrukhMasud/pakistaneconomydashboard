import { formatKpiPeriod, formatKpiChange } from './kpiFormat.js';
import { isClosedFiscalPeriod, isFiniteNumber, latestRow, pctChange } from './periodHelpers.js';

export const HEADLINE_KPI_IDS = [
  'inflation', 'reserves', 'exchange-rate', 'remittances', 'trade', 'policy-rate',
];

export function selectHeadlineKpis(indicators) {
  const byId = new Map((indicators || []).map((row) => [row.id, row]));
  return HEADLINE_KPI_IDS.map((id) => byId.get(id)).filter(Boolean);
}

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
  'circular-debt': { groupId: 'fiscal', sectionId: 'fiscal', datasetId: 'circular-debt' },
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
  const latest = kpi.period
    ? rows?.find((row) => row.date === kpi.period)
    : latestRow(rows);
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
    momChangeBasis: kpi.changeBasis,
    change: move.pct,
    changeUnit: '%',
    changeBasis: `vs ${formatKpiPeriod(prior.date)} (YoY)`,
    trend: move.direction === 'flat' ? 'stable' : move.direction,
    sentiment,
    headlineKind: 'yoy',
    comparisonPeriod: prior.date,
    period: kpi.period || latest.date,
  };
}

export function tradeComparison(current, previous, period, kind) {
  if (!isFiniteNumber(current) || !isFiniteNumber(previous)) return null;
  const delta = current - previous;
  const direction = delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat';
  const sameSide = current < 0 && previous < 0 || current > 0 && previous > 0;
  const change = sameSide ? pctChange(current, previous).pct : Math.round(delta) / 1000;
  const unit = sameSide ? '%' : 'USD bn';
  let key;
  let fallback;
  if (delta === 0) {
    key = 'overview.trade.unchanged';
    fallback = 'Balance unchanged';
  } else if (current < 0 && previous < 0) {
    key = delta < 0 ? 'overview.trade.deficitWidened' : 'overview.trade.deficitNarrowed';
    fallback = delta < 0 ? 'Deficit widened {value}' : 'Deficit narrowed {value}';
  } else if (current > 0 && previous > 0) {
    key = delta > 0 ? 'overview.trade.surplusWidened' : 'overview.trade.surplusNarrowed';
    fallback = delta > 0 ? 'Surplus widened {value}' : 'Surplus narrowed {value}';
  } else {
    key = delta > 0 ? 'overview.trade.improved' : 'overview.trade.deteriorated';
    fallback = delta > 0 ? 'Balance improved {value}' : 'Balance deteriorated {value}';
  }
  return {
    change,
    changeUnit: unit,
    changeBasis: `vs ${formatKpiPeriod(period)} (${kind})`,
    comparisonPeriod: period,
    headlineKind: kind.toLowerCase(),
    trend: direction === 'flat' ? 'stable' : direction,
    sentiment: delta > 0 ? 'positive' : delta < 0 ? 'negative' : 'neutral',
    changeDescription: { key, fallback, value: `${Math.abs(change)}${unit === '%' ? '%' : ` ${unit}`}` },
  };
}

export function buildTradeKpi(trade) {
  const rows = [...(trade?.monthly || [])].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const latest = latestRow(rows);
  if (!latest || !isFiniteNumber(latest.balance)) return null;
  const yearAgo = yoyMatch(rows, latest.date);
  const [year, month] = latest.date.split('-').map(Number);
  const priorDate = `${month === 1 ? year - 1 : year}-${String(month === 1 ? 12 : month - 1).padStart(2, '0')}`;
  const prior = rows.find((row) => row.date === priorDate);
  const yoy = tradeComparison(latest.balance, yearAgo?.balance, yearAgo?.date, 'YoY');
  const mom = tradeComparison(latest.balance, prior?.balance, prior?.date, 'MoM');
  const comparison = yoy || mom;

  return {
    id: 'trade',
    label: 'Trade Balance (Monthly)',
    value: latest.balance / 1000,
    decimals: 2,
    unit: 'USD bn',
    period: latest.date,
    trend: 'stable',
    sentiment: 'neutral',
    ...comparison,
    momComparison: yoy ? mom : null,
    source: 'SBP',
    sourceType: 'official-derived',
    sub: isFiniteNumber(latest.exports) && isFiniteNumber(latest.imports)
      ? `Exports ${(latest.exports / 1000).toFixed(2)} USD bn · Imports ${(latest.imports / 1000).toFixed(2)} USD bn`
      : null,
  };
}

export function buildSnapshotKpi(row) {
  if (!row?.id) return null;
  const completedCurrentAccount = row.id === 'current-account' && isClosedFiscalPeriod(row.asOf);
  return {
    id: row.id,
    label: completedCurrentAccount ? 'Current Account (Full year)' : row.label,
    labelKey: completedCurrentAccount ? 'overview.currentAccountFullYear' : undefined,
    displayValue: `${row.value}${row.unit ? ` ${row.unit}` : ''}`.trim(),
    period: row.asOf,
    changeLabel: row.change || null,
    changeBasis: row.note || null,
    trend: row.trend || 'stable',
    sentiment: row.sentiment || 'neutral',
    source: row.source,
    sourceUrl: row.sourceUrl,
    sourceType: row.sourceType,
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

export function buildOverviewIndicators({ summary, trade, remittances, snapshot } = {}) {
  const snapshotIds = ['current-account', 'public-debt', 'circular-debt'];
  return decorateOverviewKpis(mergeOverviewIndicators(summary?.indicators, [
    buildTradeKpi(trade),
    ...snapshotIds.map((id) => buildSnapshotKpi(snapshot?.indicators?.find((row) => row.id === id))),
  ]), { remittances });
}

export function overviewFreshness(indicators, freshness) {
  const datasets = new Map((freshness?.datasets || []).map((row) => [row.id, row]));
  const sources = (indicators || []).map((row) => datasets.get(kpiRoute(row.id).datasetId)).filter(Boolean);
  const latestDate = (key) => sources.map((row) => row[key]).filter(Boolean).sort().at(-1) || null;
  return { checked: latestDate('verificationDate'), changed: latestDate('dashboardUpdated'), datasets };
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
export function buildOverviewClauses({ inflation, remittances, trade, fbrGap, fbrPeriod, fbrGapUnit = 'Rs bn' } = {}) {
  const clauses = [];

  if (Number.isFinite(inflation?.value) && inflation.period) {
    const delta = inflation.change;
    const key = delta < 0
      ? 'overview.picture.inflationCooled'
      : delta > 0
        ? 'overview.picture.inflationRose'
        : Number.isFinite(delta) ? 'overview.picture.inflationHeld' : 'overview.picture.inflationAt';
    const verb = delta < 0 ? 'cooled to' : delta > 0 ? 'rose to' : Number.isFinite(delta) ? 'held at' : 'was';
    clauses.push({
      id: 'inflation',
      key,
      fallback: `Inflation ${verb} {value}% in {period}`,
      value: String(inflation.value),
      period: formatKpiPeriod(inflation.period),
    });
  }

  if (Number.isFinite(remittances?.change) && remittances.headlineKind === 'yoy' && remittances.period) {
    const key = remittances.change > 0.5
      ? 'overview.picture.remittancesUp'
      : remittances.change < -0.5
        ? 'overview.picture.remittancesDown'
        : 'overview.picture.remittancesFlat';
    const fallback = remittances.change > 0.5
      ? 'remittances in {period} were {value}% higher than a year earlier'
      : remittances.change < -0.5
        ? 'remittances in {period} were {value}% lower than a year earlier'
        : 'remittances in {period} were little changed from a year earlier';
    clauses.push({
      id: 'remittances',
      key,
      fallback,
      value: signedAbs(remittances.change),
      period: formatKpiPeriod(remittances.period),
    });
  }

  if (Number.isFinite(trade?.value) && trade.period) {
    const deficit = trade.value < 0;
    clauses.push({
      id: 'trade',
      key: trade.value === 0 ? 'overview.picture.tradeBalanced' : deficit ? 'overview.picture.tradeDeficit' : 'overview.picture.tradeSurplus',
      fallback: deficit
        ? 'the goods deficit in {period} was {value} USD bn'
        : trade.value === 0 ? 'goods trade was balanced in {period}' : 'the goods surplus in {period} was {value} USD bn',
      value: signedAbs(trade.value, 2),
      period: formatKpiPeriod(trade.period),
    });
  }

  if (Number.isFinite(fbrGap) && fbrPeriod) {
    const ahead = fbrGap >= 0;
    const completed = isClosedFiscalPeriod(fbrPeriod);
    clauses.push({
      id: 'fbr',
      key: completed
        ? ahead ? 'overview.picture.fbrFullAhead' : 'overview.picture.fbrFullShort'
        : ahead ? 'overview.picture.fbrAhead' : 'overview.picture.fbrShort',
      fallback: completed
        ? ahead ? 'FBR ended {period} {value} ahead of its full-year target' : 'FBR ended {period} {value} short of its full-year target'
        : ahead ? 'FBR was {value} ahead of its target for {period} (FYTD)' : 'FBR was {value} short of its target for {period} (FYTD)',
      value: `${signedAbs(fbrGap, 0)} ${fbrGapUnit}`,
      period: formatKpiPeriod(fbrPeriod),
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
