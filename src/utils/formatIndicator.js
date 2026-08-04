import { formatDayMonthYear, formatMonthYear } from './periodHelpers.js';

function numericText(indicator) {
  if (!Number.isFinite(indicator?.value)) return String(indicator?.value ?? '—');
  return Number.isFinite(indicator.decimals)
    ? indicator.value.toFixed(indicatorDecimals(indicator))
    : String(indicator.value);
}

export function indicatorDecimals(indicator) {
  if (Number.isFinite(indicator?.decimals)) return indicator.decimals;
  if (!Number.isFinite(indicator?.value) || Number.isInteger(indicator.value)) return 0;
  const decimalPlaces = String(indicator.value).split('.')[1]?.length || 0;
  return Math.min(decimalPlaces, 2);
}

export function indicatorValueParts(indicator) {
  const value = numericText(indicator);
  const unit = String(indicator?.unit || '').trim();

  if (unit === '$ Billion' || unit === '$B') return { prefix: '$', value, suffix: 'B' };
  if (unit === 'T PKR') return { prefix: 'Rs ', value, suffix: 'T' };
  if (unit === 'B PKR') return { prefix: 'Rs ', value, suffix: 'B' };
  if (unit === 'PKR') return { prefix: 'Rs ', value, suffix: '' };
  if (unit === '%') return { prefix: '', value, suffix: '%' };
  return { prefix: '', value, suffix: unit ? ` ${unit}` : '' };
}

export function formatIndicatorValue(indicator) {
  const { prefix, value, suffix } = indicatorValueParts(indicator);
  return `${prefix}${value}${suffix}`;
}

export function formatIndicatorChange(indicator) {
  if (!Number.isFinite(indicator?.change)) return null;

  const value = Math.abs(indicator.change);
  const sign = indicator.change > 0 ? '+' : indicator.change < 0 ? '-' : '';
  const unit = String(indicator.changeUnit || '').trim();

  if (unit === '$B' || unit === '$ Billion') return `${sign}$${value}B`;
  if (unit === 'T PKR') return `${sign}Rs ${value}T`;
  if (unit === 'B PKR') return `${sign}Rs ${value}B`;
  if (unit === 'PKR') return `${sign}Rs ${value}`;
  if (unit === '%' || unit === 'pp') return `${sign}${value}${unit}`;
  return unit ? `${sign}${value} ${unit}` : `${sign}${value}`;
}

export function formatIndicatorPeriod(period) {
  if (!period) return '';
  if (/^\d{4}-\d{2}-\d{2}$/.test(period)) return formatDayMonthYear(period);
  if (/^\d{4}-\d{2}$/.test(period)) return formatMonthYear(period);
  return period;
}
