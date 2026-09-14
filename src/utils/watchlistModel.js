import { INDICATOR_CATALOG } from './indicatorCatalog.js';
import { formatKpiDisplay, formatKpiPeriod } from './kpiFormat.js';
import { kpiRoute, KPI_ROUTES } from './overviewModel.js';

const ALIASES = {
  'ind-reserves': 'reserves',
  'ind-exchange': 'exchange-rate',
  'ind-trade': 'trade',
  'ind-remit': 'remittances',
  'ind-fdi': 'fdi',
  'ind-it': 'it_exports',
  'ind-cpi': 'inflation',
  'ind-policy': 'policy-rate',
  'ind-gdp': 'gdp-growth',
  'ind-fbr': 'fbr-tax',
  'ind-circular': 'circular-debt',
};

const KPI_LABELS = {
  reserves: 'Foreign Reserves (Total)',
  'exchange-rate': 'PKR / USD',
  remittances: 'Remittances (Monthly)',
  fdi: 'Net FDI',
  it_exports: 'IT & Telecom Exports',
  'gdp-growth': 'GDP Growth Rate',
  inflation: 'CPI Inflation (YoY)',
  'fbr-tax': 'FBR Tax Collection',
  'policy-rate': 'SBP Policy Rate',
  trade: 'Trade Balance (Monthly)',
  'current-account': 'Current Account',
  'public-debt': 'Total Public Debt',
  'circular-debt': 'Power Circular Debt',
};

export function normalizePinId(id) {
  return ALIASES[id] || id;
}

export function normalizePins(pins) {
  return [...new Set((Array.isArray(pins) ? pins : [])
    .filter((id) => typeof id === 'string' && id.trim())
    .map(normalizePinId))];
}

export function resolveWatchlistItems(pins, indicators = []) {
  const byId = new Map(indicators.map((row) => [normalizePinId(row.id), row]));
  const catalog = new Map(INDICATOR_CATALOG.map((row) => [row.id, row]));
  return normalizePins(pins).map((id) => {
    const kpi = byId.get(id);
    if (kpi || KPI_ROUTES[id]) {
      return {
        ...kpiRoute(id),
        id,
        kind: 'kpi',
        label: kpi?.label || KPI_LABELS[id],
        labelKey: kpi?.labelKey,
        value: kpi ? formatKpiDisplay(kpi) : null,
        period: kpi ? formatKpiPeriod(kpi.period) : null,
        sentiment: kpi?.sentiment || 'neutral',
        provenanceKey: kpi?.provenanceKey,
        sourceType: kpi?.sourceType,
      };
    }
    const entry = catalog.get(id);
    if (entry) return { ...entry, kind: 'catalog', value: null, period: null, sentiment: 'neutral' };
    return { id, kind: 'unknown', value: null, period: null, sentiment: 'neutral' };
  });
}
