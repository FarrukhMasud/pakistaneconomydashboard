export function formatKpiNumber(kpi) {
  if (!Number.isFinite(kpi?.value)) return String(kpi?.value ?? '—');
  const decimals = Number.isFinite(kpi.decimals)
    ? kpi.decimals
    : Number.isInteger(kpi.value) ? 0 : 2;
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
