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
  const normalized = {
    '$ Billion': 'USD bn',
    '$B': 'USD bn',
    'T PKR': 'PKR tn',
  };
  return normalized[unit] || unit || '';
}

export function formatKpiPeriod(period) {
  if (!period) return '—';
  const monthly = period.match(/^(\d{4})-(\d{2})$/);
  if (monthly) {
    return new Date(`${period}-01T00:00:00Z`).toLocaleDateString('en-US', {
      month: 'short',
      year: 'numeric',
      timeZone: 'UTC',
    });
  }
  return period.replace(/\bFY(\d{2})\b/g, (_, year) => `FY20${year}`);
}

export function isProvisionalPeriod(period) {
  return /\bprovisional\b|\(P\)|\bEst\./i.test(String(period || ''));
}
