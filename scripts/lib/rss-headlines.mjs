import {
  formatCompareBasis,
  formatKpiChange,
  formatKpiDisplay,
  formatKpiPeriod,
} from '../../src/utils/kpiFormat.js';
import { SITE_URL } from './seo-routes.mjs';

/** Map KPI ids from kpi-summary.json to public dashboard paths. */
export const KPI_PATHS = {
  reserves: '/external/reserves',
  'exchange-rate': '/external/exchange',
  remittances: '/external/remittances',
  fdi: '/external/fdi',
  it_exports: '/external/services',
  'gdp-growth': '/fiscal/fiscal',
  inflation: '/prices/inflation',
  'fbr-tax': '/fiscal/fbr',
  'policy-rate': '/prices/monetary',
};

export function formatHeadlineTitle(kpi) {
  const value = formatKpiDisplay(kpi);
  const change = formatKpiChange(kpi);
  const period = formatKpiPeriod(kpi.period);
  if (change) return `${kpi.label}: ${value}, ${change} (${period})`;
  return `${kpi.label}: ${value} (${period})`;
}

export function formatHeadlineDescription(kpi) {
  return [formatCompareBasis(kpi.changeBasis), kpi.source, kpi.sub]
    .filter(Boolean)
    .join(' · ');
}

export function buildHeadlineItems(kpiSummary, site = SITE_URL) {
  return (kpiSummary.indicators || []).map((indicator) => ({
    title: formatHeadlineTitle(indicator),
    link: `${site}${KPI_PATHS[indicator.id] || '/overview/overview'}`,
    pubDate: new Date(kpiSummary.lastUpdated || Date.now()).toUTCString(),
    guid: `kpi-${indicator.id}-${indicator.period}-${indicator.value}`,
    desc: formatHeadlineDescription(indicator),
  }));
}
