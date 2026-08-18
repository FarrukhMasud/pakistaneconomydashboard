import { useData } from '../../hooks/useData';
import { COLORS } from '../../utils/chartConfig';
import { deriveFiscalLabels, isClosedFiscalPeriod } from '../../utils/periodHelpers';

export const SOURCE_LINKS = [
  { label: 'SBP', url: 'https://www.sbp.org.pk' },
  { label: 'PBS', url: 'https://www.pbs.gov.pk' },
  { label: 'Finance Division', url: 'https://www.finance.gov.pk' },
  { label: 'FBR', url: 'https://www.fbr.gov.pk' },
  { label: 'World Bank Data', url: 'https://data.worldbank.org' },
  { label: 'IMF Pakistan', url: 'https://www.imf.org/en/Countries/PAK' },
];

export function sourceLinksWithFytd(fytd) {
  if (!fytd?.source) return SOURCE_LINKS;
  const closed = isClosedFiscalPeriod(fytd.period);
  return [...SOURCE_LINKS, { label: fytd.sourceLabel || (closed ? 'FBR full-year source' : 'FBR FYTD source'), url: fytd.source }];
}

export function fmt(value, digits = 1) {
  if (value == null || Number.isNaN(value)) return '—';
  return Number(value).toLocaleString(undefined, { maximumFractionDigits: digits });
}

export function signed(value, suffix = '', digits = 1) {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value >= 0 ? '+' : ''}${fmt(value, digits)}${suffix}`;
}

export function latest(rows = []) {
  return rows.at(-1) || null;
}

export function previous(rows = []) {
  return rows.length > 1 ? rows.at(-2) : null;
}

export function yoyRow(rows = [], date) {
  if (!date) return null;
  const [year, month] = date.split('-');
  return rows.find((row) => row.date === `${Number(year) - 1}-${month}`);
}

export function pctChange(current, prior) {
  if (current == null || prior == null || prior === 0) return null;
  return ((current - prior) / Math.abs(prior)) * 100;
}

export function trendClass(value, positiveWhenUp = true) {
  if (value == null || Math.abs(value) < 0.05) return 'neutral';
  const positive = positiveWhenUp ? value > 0 : value < 0;
  return positive ? 'positive' : 'negative';
}

export function toneFromStatus(status) {
  if (['met', 'strong', 'positive', 'ok'].includes(status)) return 'positive';
  if (['at risk', 'behind', 'pressure', 'negative'].includes(status)) return 'negative';
  return 'neutral';
}

export function fmtPct(value) {
  if (value == null || Number.isNaN(value)) return '—';
  return `${value >= 0 ? '+' : ''}${fmt(value)}%`;
}

export function fmtPkrBn(value) {
  if (value == null || Number.isNaN(value)) return '—';
  return `₨${fmt(value, 0)}B`;
}

export function resolveFyLabels(...sources) {
  for (const src of sources) {
    const rows = src?.data?.monthly || src?.data?.weekly || src?.monthly || src?.weekly
      || src?.data?.national_cpi?.data;
    const labels = deriveFiscalLabels(rows);
    if (labels) return labels;
  }
  const now = new Date();
  const ym = `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;
  return deriveFiscalLabels(ym) || {
    fy: now.getUTCFullYear(),
    fyLabel: `FY${String(now.getUTCFullYear()).slice(-2)}`,
    fyFull: `FY${now.getUTCFullYear()}`,
    priorFy: now.getUTCFullYear() - 1,
    priorLabel: `FY${String(now.getUTCFullYear() - 1).slice(-2)}`,
    priorFull: `FY${now.getUTCFullYear() - 1}`,
  };
}

export function multiState(results) {
  const loading = results.some((r) => r.loading);
  const failed = results.filter((r) => r.error);
  const retryAll = () => results.forEach((r) => r.retry?.());
  return { loading, failed, retryAll, hasPartialFailure: !loading && failed.length > 0 };
}

export { useData, COLORS };
