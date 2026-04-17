/**
 * Helpers for deriving "current period" from data arrays.
 * Works off actual data — never hardcodes a year.
 */

const MONTH_NAMES = [
  'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
];

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

  // Prior FY: same number of months in the previous FY
  const priorFY = fy - 1;
  const priorStartYear = priorFY - 1;
  const priorRows = sorted.filter(r => {
    const p = parseYM(r.date);
    if (p.year === priorStartYear && p.month >= fyStartMonth) return true;
    if (p.year === priorFY && p.month <= latest.month) return true;
    return false;
  });

  const firstFYRow = parseYM(fyRows[0].date);
  const rangeLabel = `Jul ${fyStartYear} – ${MONTH_NAMES[latest.month - 1]} ${latest.year}`;

  return {
    fy,
    fyLabel: `FY${String(fy).slice(-2)}`,
    rows: fyRows,
    prior: priorRows,
    priorLabel: `FY${String(priorFY).slice(-2)}`,
    rangeLabel,
    months: fyRows.length,
  };
}
