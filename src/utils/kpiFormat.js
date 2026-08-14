const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const UNIT_MAP = {
  '$ Billion': 'USD bn',
  '$B': 'USD bn',
  'T PKR': 'Rs tn',
  'PKR tn': 'Rs tn',
};

export function getKpiDecimals(kpi) {
  if (!Number.isFinite(kpi?.value)) return 0;
  if (Number.isFinite(kpi.decimals)) return kpi.decimals;
  if (Number.isInteger(kpi.value)) return 0;
  const fraction = String(kpi.value).split('.')[1] || '';
  return Math.min(fraction.length, 2);
}

export function formatKpiNumber(kpi) {
  if (!Number.isFinite(kpi?.value)) return String(kpi?.value ?? '—');
  const decimals = getKpiDecimals(kpi);
  return kpi.value.toLocaleString(undefined, {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function formatKpiUnit(unit) {
  if (!unit) return '';
  return UNIT_MAP[unit] || unit;
}

/** Daily → `31 Jul 2026`, monthly → `Jul 2026`, FY26 → FY2026. */
export function formatKpiPeriod(period) {
  if (!period) return '—';
  const text = String(period);
  const daily = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (daily) {
    return `${Number(daily[3])} ${MONTHS[Number(daily[2]) - 1]} ${daily[1]}`;
  }
  const monthly = text.match(/^(\d{4})-(\d{2})$/);
  if (monthly) {
    return `${MONTHS[Number(monthly[2]) - 1]} ${monthly[1]}`;
  }
  return text.replace(/\bFY(\d{2})\b/g, (_, year) => `FY20${year}`);
}

/** Replace ISO dates inside compare-with strings. */
export function formatCompareBasis(basis) {
  if (!basis) return '';
  return String(basis)
    .replace(/\b(\d{4}-\d{2}-\d{2})\b/g, (_, iso) => formatKpiPeriod(iso))
    .replace(/\b(\d{4}-\d{2})\b/g, (_, iso) => formatKpiPeriod(iso));
}

export function formatKpiChange(kpi) {
  if (kpi?.changeLabel && !Number.isFinite(kpi.change)) return kpi.changeLabel;
  if (!Number.isFinite(kpi?.change)) return null;
  const sign = kpi.change > 0 ? '+' : '';
  const unit = formatKpiUnit(kpi.changeUnit || '');
  if (unit === '%' || unit === 'pp') return `${sign}${kpi.change}${unit}`;
  if (unit) return `${sign}${kpi.change} ${unit}`;
  return `${sign}${kpi.change}`;
}

export function formatKpiDisplay(kpi) {
  if (kpi?.displayValue) return kpi.displayValue;
  const unit = formatKpiUnit(kpi?.unit);
  return `${formatKpiNumber(kpi)}${unit ? ` ${unit}` : ''}`;
}

export function isProvisionalPeriod(period) {
  return /\bprovisional\b|\(P\)|\bEst\./i.test(String(period || ''));
}
