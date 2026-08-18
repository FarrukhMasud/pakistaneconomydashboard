/**
 * Helpers for deriving "current period" from data arrays.
 * Works off actual data — never hardcodes a year.
 */

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

/** Format YYYY-MM as a timezone-safe month label. */
export function formatMonthYear(dateStr) {
  if (!dateStr) return '';
  const { year, month } = parseYM(dateStr);
  return `${MONTH_NAMES[month - 1]} ${String(year).slice(-2)}`;
}

/** Format YYYY-MM-DD without UTC/local timezone rollover. */
export function formatDayMonthYear(dateStr) {
  if (!dateStr) return '';
  const [year, month, day] = dateStr.split('-').map(Number);
  if (!year || !month || !day) return formatMonthYear(dateStr);
  return new Date(year, month - 1, day).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: '2-digit',
  });
}

/** Parse "YYYY-MM" or "YYYY-MM-DD" into { year, month } */
function parseYM(dateStr) {
  const [y, m] = dateStr.split('-').map(Number);
  return { year: y, month: m };
}

/**
 * Get the calendar-year of the latest data point.
 * @param {Array} rows – [{ date: "YYYY-MM" | "YYYY-MM-DD", ... }]
 * @returns {{ year: number, rows: Array, prior: Array, label: string, rangeLabel: string }}
 */
export function currentCalendarYear(rows) {
  if (!rows?.length) return null;
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const latest = parseYM(sorted[sorted.length - 1].date);
  const first = sorted.find(r => parseYM(r.date).year === latest.year);
  const firstMonth = first ? parseYM(first.date).month : 1;
  const currentRows = sorted.filter(r => parseYM(r.date).year === latest.year);
  const priorRows = sorted.filter(r => {
    const p = parseYM(r.date);
    return p.year === latest.year - 1 && p.month >= firstMonth && p.month <= latest.month;
  });

  const rangeLabel =
    currentRows.length === 1
      ? MONTH_NAMES[latest.month - 1] + ' ' + latest.year
      : MONTH_NAMES[firstMonth - 1] + ' – ' + MONTH_NAMES[latest.month - 1] + ' ' + latest.year;

  return {
    year: latest.year,
    rows: currentRows,
    prior: priorRows,
    label: String(latest.year),
    rangeLabel,
    months: currentRows.length,
  };
}

/**
 * Derive fiscal-year label from a date or FY string.
 * SBP convention: FY ends June 30. "2025-06-30" => FY25.
 * Already-FY strings like "FY25" pass through.
 */
export function toFYLabel(dateOrFY) {
  if (typeof dateOrFY === 'string' && dateOrFY.startsWith('FY')) return dateOrFY;
  const { year, month } = parseYM(dateOrFY);
  // FY label is the year the FY ends in (July-June cycle)
  const fy = month >= 7 ? year + 1 : year;
  return `FY${String(fy).slice(-2)}`;
}

/**
 * Compute % change between two values.
 * Returns { pct: number, direction: "up"|"down"|"flat" }
 */
export function pctChange(current, previous) {
  if (!previous || previous === 0) return { pct: null, direction: 'flat' };
  const pct = ((current - previous) / Math.abs(previous)) * 100;
  const direction = pct > 0.5 ? 'up' : pct < -0.5 ? 'down' : 'flat';
  return { pct: Math.round(pct * 10) / 10, direction };
}

/** Format a number with $ B/M suffix */
export function fmtUSD(val) {
  if (val == null) return '—';
  const abs = Math.abs(val);
  if (abs >= 1e3) return (val / 1e3).toFixed(1) + 'B';
  return val.toFixed(1) + 'M';
}

/** Format PKR with T/B/M suffix */
export function fmtPKR(val) {
  if (val == null) return '—';
  const abs = Math.abs(val);
  if (abs >= 1e6) return '₨ ' + (val / 1e6).toFixed(1) + 'T';
  if (abs >= 1e3) return '₨ ' + (val / 1e3).toFixed(0) + 'B';
  return '₨ ' + val.toFixed(0) + 'M';
}

/** Format as percentage string */
export function fmtPct(val, decimals = 1) {
  if (val == null) return '—';
  return val.toFixed(decimals) + '%';
}

/** Format exchange rate */
export function fmtRate(val) {
  if (val == null) return '—';
  return val.toFixed(2);
}

/** Sum a numeric field from an array of objects */
export function sumField(rows, field) {
  return rows.reduce((s, r) => s + (Number(r[field]) || 0), 0);
}

/** Average a numeric field */
export function avgField(rows, field) {
  if (!rows.length) return 0;
  return sumField(rows, field) / rows.length;
}

/** Get the latest value from a sorted data array */
export function latestValue(dataArr) {
  if (!dataArr?.length) return null;
  return dataArr[dataArr.length - 1].value;
}

/** Safe last row — never throws on empty/missing series. */
export function latestRow(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return null;
  return rows[rows.length - 1];
}

/** Previous row (n-2), or null. */
export function previousRow(rows) {
  if (!Array.isArray(rows) || rows.length < 2) return null;
  return rows[rows.length - 2];
}

/**
 * Derive the current / prior FY labels from any monthly-ish series
 * so insight sections never hardcode "FY2026".
 * @returns {{ fy: number, fyLabel: string, fyFull: string, priorFy: number, priorLabel: string, priorFull: string } | null}
 */
export function deriveFiscalLabels(rowsOrDate) {
  let year;
  let month;
  if (typeof rowsOrDate === 'string') {
    ({ year, month } = parseYM(rowsOrDate));
  } else if (Array.isArray(rowsOrDate) && rowsOrDate.length) {
    const sorted = [...rowsOrDate].sort((a, b) => String(a.date).localeCompare(String(b.date)));
    ({ year, month } = parseYM(sorted[sorted.length - 1].date));
  } else {
    return null;
  }
  if (!year || !month) return null;
  const fy = month >= 7 ? year + 1 : year;
  const priorFy = fy - 1;
  return {
    fy,
    fyLabel: `FY${String(fy).slice(-2)}`,
    fyFull: `FY${fy}`,
    priorFy,
    priorLabel: `FY${String(priorFy).slice(-2)}`,
    priorFull: `FY${priorFy}`,
  };
}

/** True when value is a usable finite number. */
export function isFiniteNumber(value) {
  return typeof value === 'number' && Number.isFinite(value);
}

/**
 * Build a fiscal-year-to-date series with prior-FY months aligned by calendar month.
 * Used by PeriodCompare "fytd" mode so charts show Jul→latest vs same months last FY.
 *
 * @param {Array} rows
 * @param {string} field
 * @returns {{ labels: string[], current: Array, prior: Array, currentLabel: string, priorLabel: string, rangeLabel: string, fy: object } | null}
 */
export function buildFytdSeries(rows, field) {
  const fy = currentFiscalYear(rows);
  if (!fy?.rows?.length) return null;

  const priorByMonth = {};
  for (const row of fy.prior || []) {
    const { month } = parseYM(row.date);
    const value = row[field];
    priorByMonth[month] = value == null || value === '' ? null : value;
  }

  return {
    labels: fy.rows.map((row) => formatMonthYear(row.date)),
    current: fy.rows.map((row) => {
      const value = row[field];
      return value == null || value === '' ? null : value;
    }),
    prior: fy.rows.map((row) => {
      const { month } = parseYM(row.date);
      return Object.prototype.hasOwnProperty.call(priorByMonth, month)
        ? priorByMonth[month]
        : null;
    }),
    currentLabel: fy.fyLabel,
    priorLabel: fy.priorLabel,
    rangeLabel: fy.rangeLabel,
    fy,
  };
}

/**
 * Build a year-over-year overlay dataset from monthly data.
 * Returns prior-year values aligned to the same month positions.
 *
 * @param {Array} rows – sorted [{ date: "YYYY-MM", ... }]
 * @param {string} field – field name to extract (e.g. 'total', 'sbp')
 * @returns {{ priorData: Array, priorLabel: string }} – array aligned to rows, null where no prior data
 */
export function buildYoYOverlay(rows, field, { matchGrain = false } = {}) {
  if (!rows?.length) return { priorData: [], priorLabel: '' };

  const byDate = {};
  const byYM = {};
  rows.forEach((r) => {
    const { year, month } = parseYM(r.date);
    byDate[r.date] = r[field];
    byYM[`${year}-${month}`] = r[field];
  });

  const latest = parseYM(rows[rows.length - 1].date);
  const priorYear = latest.year - 1;

  const priorData = rows.map((r) => {
    const { year, month } = parseYM(r.date);
    if (String(r.date).length > 7) {
      const exact = String(r.date).replace(/^\d{4}/, String(year - 1));
      if (Object.prototype.hasOwnProperty.call(byDate, exact)) return byDate[exact];
      if (matchGrain) return null;
    }
    return byYM[`${year - 1}-${month}`] ?? null;
  });

  return {
    priorData,
    priorLabel: `Same period ${priorYear}`,
  };
}

/**
 * Get the fiscal-year-to-date slice of monthly data.
 * Pakistan FY runs Jul–Jun. FY26 = Jul 2025 – Jun 2026.
 *
 * @param {Array} rows – [{ date: "YYYY-MM", ... }]
 * @returns {{ fy: number, fyLabel: string, rows: Array, prior: Array, rangeLabel: string, months: number } | null}
 */
export function currentFiscalYear(rows) {
  if (!rows?.length) return null;
  const sorted = [...rows].sort((a, b) => a.date.localeCompare(b.date));
  const latest = parseYM(sorted[sorted.length - 1].date);

  // Determine which FY the latest data falls in
  const fy = latest.month >= 7 ? latest.year + 1 : latest.year; // e.g. Mar 2026 → FY26, Oct 2025 → FY26
  const fyStartYear = fy - 1; // FY26 starts Jul 2025
  const fyStartMonth = 7;

  // Filter rows belonging to this FY (Jul of fyStartYear through latest)
  const fyRows = sorted.filter(r => {
    const p = parseYM(r.date);
    if (p.year === fyStartYear && p.month >= fyStartMonth) return true;
    if (p.year === fy && p.month <= latest.month) return true;
    return false;
  });

  if (!fyRows.length) return null;

  // Prior FYTD: same calendar months in the previous fiscal year.
    // e.g. current through Sep 2025 (FY26) → prior Jul–Sep 2024 (FY25).
    const priorFY = fy - 1;
    const priorStartYear = priorFY - 1;
    const priorRows = sorted.filter((r) => {
      const p = parseYM(r.date);
      if (p.year === priorStartYear && p.month >= fyStartMonth) {
        // Jul–Dec of the year the prior FY starts
        return latest.month >= 7 ? p.month <= latest.month : true;
      }
      if (p.year === priorFY && p.month <= 6) {
        // Jan–Jun of the year the prior FY ends
        return latest.month >= 7 ? false : p.month <= latest.month;
      }
      return false;
    });

  const elapsedMonths = latest.month >= 7 ? latest.month - 6 : latest.month + 6;
  const rangeLabel = elapsedMonths === 1
    ? `${MONTH_NAMES[latest.month - 1]} ${latest.year}`
    : `Jul ${fyStartYear} – ${MONTH_NAMES[latest.month - 1]} ${latest.year}`;

  return {
    fy,
    fyLabel: `FY${String(fy).slice(-2)}`,
    rows: fyRows,
    prior: priorRows,
    priorLabel: `FY${String(priorFY).slice(-2)}`,
    rangeLabel,
    months: fyRows.length,
    elapsedMonths,
  };
}

/** Calendar months elapsed in the current FY (Jul = 1 … Jun = 12). */
export const MIN_FYTD_CHART_MONTHS = 3;

export function isThinFiscalYear(fy, minMonths = MIN_FYTD_CHART_MONTHS) {
  if (!fy) return true;
  const elapsed = fy.elapsedMonths ?? fy.months ?? 0;
  return elapsed < minMonths;
}

/** True when the FY window is long but most months are missing. */
export function isSparseFiscalYear(fy) {
  if (!fy?.rows?.length) return true;
  const elapsed = fy.elapsedMonths ?? fy.months ?? fy.rows.length;
  if (elapsed <= 1) return false;
  return fy.rows.length < Math.max(2, Math.ceil(elapsed * 0.5));
}

export function fytdViewReady(fy, minMonths = MIN_FYTD_CHART_MONTHS) {
  return Boolean(fy?.rows?.length) && !isThinFiscalYear(fy, minMonths) && !isSparseFiscalYear(fy);
}

/** If FYTD was requested but the window is too thin or gappy, fall back to YoY. */
export function resolveCompareMode(requested, fy, minMonths = MIN_FYTD_CHART_MONTHS) {
  if (requested !== 'fytd') return requested;
  if (!fytdViewReady(fy, minMonths)) return 'yoy';
  return 'fytd';
}

export function fytdDisabledReason(fy, minMonths = MIN_FYTD_CHART_MONTHS) {
  if (!fy?.rows?.length) return 'FYTD comparison needs fiscal-year data.';
  if (isThinFiscalYear(fy, minMonths)) {
    return 'FYTD charts need at least 3 months of the new fiscal year.';
  }
  if (isSparseFiscalYear(fy)) {
    return 'FYTD view needs a more complete monthly path for this fiscal year.';
  }
  return null;
}

export function formatFySummaryTitle(fy, { closed = false } = {}) {
  if (!fy) return '';
  if (closed) return `${fy.fyLabel} (${fy.rangeLabel}) — Full year`;
  if ((fy.elapsedMonths ?? fy.months) === 1) {
    return `${fy.fyLabel} · ${fy.rangeLabel} only — First month`;
  }
  return `${fy.fyLabel} (${fy.rangeLabel}) — Fiscal YTD`;
}

/** Jul–Jun (any dash) is a completed fiscal year, not an in-progress FYTD. */
export function isClosedFiscalPeriod(period) {
  return /jul\s*[–-]\s*jun/i.test(String(period || ''));
}

export function fbrCollectionLabel(fytd) {
  if (!fytd) return 'FBR Tax Collection';
  if (isClosedFiscalPeriod(fytd.period)) {
    return `FBR Tax Collection (${fytd.fyLabel || 'full year'})`;
  }
  return 'FBR Tax Collection (FYTD)';
}

function monthNameToNumber(name) {
  if (!name) return null;
  const idx = MONTH_NAMES.findIndex((m) => m.toLowerCase() === String(name).slice(0, 3).toLowerCase());
  return idx >= 0 ? idx + 1 : null;
}

/** Build a same-month YoY snapshot from a monthly series (latest vs year-ago). */
export function buildMonthlyComparisonFromSeries(rows, field = 'net_fdi') {
  if (!rows?.length) return null;
  const sorted = [...rows].sort((a, b) => String(a.date).localeCompare(String(b.date)));
  const latest = sorted[sorted.length - 1];
  const { year, month } = parseYM(latest.date);
  if (!year || !month || latest[field] == null) return null;
  const priorDate = `${year - 1}-${String(month).padStart(2, '0')}`;
  const prior = sorted.find((row) => String(row.date).startsWith(priorDate));
  if (!prior || prior[field] == null) return null;
  const currentLabels = deriveFiscalLabels(latest.date);
  const priorLabels = deriveFiscalLabels(prior.date);
  return {
    month: MONTH_NAMES[month - 1],
    current: {
      label: currentLabels?.fyFull || `FY${year}`,
      net_fdi: latest.net_fdi ?? latest[field],
      inflow: latest.inflow ?? null,
      outflow: latest.outflow ?? null,
      equity: latest.equity ?? null,
      debt: latest.debt ?? null,
      date: latest.date,
    },
    prior: {
      label: priorLabels?.fyFull || `FY${year - 1}`,
      net_fdi: prior.net_fdi ?? prior[field],
      inflow: prior.inflow ?? null,
      outflow: prior.outflow ?? null,
      date: prior.date,
    },
    source: 'monthly-series',
  };
}

/** Prefer the monthly-series snapshot when it covers a later month/FY than the workbook cut. */
export function preferNewerMonthlyComparison(workbook, seriesDerived) {
  if (!seriesDerived) return workbook || null;
  if (!workbook) return seriesDerived;
  const seriesDate = seriesDerived.current?.date;
  if (!seriesDate) return workbook;
  const series = parseYM(seriesDate);
  const wbMonth = monthNameToNumber(workbook.month);
  const wbFy = parseInt(String(workbook.current?.label || '').replace(/\D/g, ''), 10);
  const seriesFy = deriveFiscalLabels(seriesDate)?.fy;
  if (seriesFy && wbFy && seriesFy > wbFy) return seriesDerived;
  if (seriesFy && wbFy && seriesFy === wbFy && wbMonth != null && series.month > wbMonth) {
    return seriesDerived;
  }
  return workbook;
}
