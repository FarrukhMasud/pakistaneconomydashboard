/**
 * Shared, side-effect-free helpers for resolving Excel columns and rows by
 * *label* rather than by hardcoded position.
 *
 * Rationale: SBP publishes workbooks whose column layout shifts every time a
 * new month or fiscal year is released. Any parser that hardcodes a fiscal year
 * (`/FY26/`) or falls back to a fixed column index will silently publish the
 * wrong number the moment the layout moves. Everything here therefore either
 * resolves from the sheet's own labels or throws.
 *
 * These functions are pure so they can be unit-tested against fixture rows.
 */

export class SheetParseError extends Error {
  constructor(message, context = {}) {
    const detail = Object.entries(context)
      .filter(([, v]) => v !== undefined && v !== null)
      .map(([k, v]) => `${k}=${typeof v === 'string' ? v : JSON.stringify(v)}`)
      .join(', ');
    super(detail ? `${message} (${detail})` : message);
    this.name = 'SheetParseError';
    this.context = context;
  }
}

/**
 * Convert an SBP fiscal-year token to a full year.
 * "FY26" to 2026, "FY99" to 1999, "2026" to 2026.
 */
export function parseFiscalYear(raw) {
  if (raw === null || raw === undefined) return null;
  const text = String(raw);
  const match = text.match(/FY\s*(\d{2,4})/i) || text.match(/^\s*(\d{2,4})\s*$/);
  if (!match) return null;
  const n = parseInt(match[1], 10);
  if (!Number.isFinite(n)) return null;
  if (n > 1900) return n;
  if (n > 99) return null;
  return n >= 90 ? 1900 + n : 2000 + n;
}

/** Highest fiscal year mentioned anywhere in a header row. Null when none. */
export function latestFiscalYear(row = []) {
  let max = null;
  for (const cell of row) {
    const fy = parseFiscalYear(cell);
    if (fy !== null && (max === null || fy > max)) max = fy;
  }
  return max;
}

/**
 * Excel merged cells only carry a value in their first column. Forward-fill a
 * header row so every column reports the period label that visually spans it.
 */
export function forwardFill(row = [], length = row.length) {
  const out = new Array(length);
  let last = '';
  for (let c = 0; c < length; c++) {
    const v = row[c] === null || row[c] === undefined ? '' : String(row[c]).trim();
    if (v) last = v;
    out[c] = v || last;
  }
  return out;
}

/**
 * Resolve the column holding the fiscal-year-to-date figures for a given
 * fiscal year, using the period row (e.g. "Jul-May") and the FY row
 * (e.g. "FY26 (P)"). Throws when nothing matches - never guesses.
 *
 * @returns {{ column:number, fiscalYear:number, period:string, status:string }}
 */
export function resolveFytdColumn(periodRow, fyRow, fiscalYear, context = {}) {
  const width = Math.max(periodRow?.length || 0, fyRow?.length || 0);
  const periods = forwardFill(periodRow || [], width);
  let found = null;

  for (let c = width - 1; c >= 1; c--) {
    const period = periods[c] || '';
    const fyCell = fyRow?.[c] === null || fyRow?.[c] === undefined ? '' : String(fyRow[c]).trim();
    if (!fyCell) continue;
    if (parseFiscalYear(fyCell) !== fiscalYear) continue;
    // A fiscal-year-to-date column starts at July but is not the full year.
    if (!/^jul\s*[-\u2013]/i.test(period)) continue;
    if (/jul\s*[-\u2013]\s*jun/i.test(period)) continue;
    found = { column: c, period: period.replace(/\s*\(.*$/, '').trim(), fyCell };
    break;
  }

  if (!found) {
    throw new SheetParseError('Could not resolve fiscal-year-to-date column', {
      ...context,
      fiscalYear,
      periodRow: (periodRow || []).map((v) => (v == null ? '' : String(v))).join('|'),
      fyRow: (fyRow || []).map((v) => (v == null ? '' : String(v))).join('|'),
    });
  }

  const marker = `${found.period} ${found.fyCell}`;
  return {
    column: found.column,
    fiscalYear,
    period: found.period,
    status: /\(\s*P\s*\)/i.test(marker) ? 'provisional' : /\(\s*R\s*\)/i.test(marker) ? 'revised' : 'final',
  };
}

/**
 * Find a row by matching a regular expression against its label column.
 * Returns -1 when absent; use `requireRowIndex` when the row is mandatory.
 */
export function findRowIndex(rows, pattern, { labelCol = 0, from = 0, to = rows.length } = {}) {
  for (let i = from; i < Math.min(to, rows.length); i++) {
    const label = rows[i]?.[labelCol];
    if (label === null || label === undefined) continue;
    if (pattern.test(String(label).trim())) return i;
  }
  return -1;
}

/** Same as findRowIndex but throws a descriptive error instead of returning -1. */
export function requireRowIndex(rows, pattern, options = {}) {
  const index = findRowIndex(rows, pattern, options);
  if (index < 0) {
    const from = options.from || 0;
    throw new SheetParseError('Could not locate required row', {
      pattern: String(pattern),
      labelCol: options.labelCol,
      from,
      sampleLabels: rows
        .slice(from, from + 60)
        .map((r) => (r?.[options.labelCol || 0] ?? '').toString().trim())
        .filter(Boolean)
        .slice(0, 20)
        .join(' | '),
    });
  }
  return index;
}

/** Assert a resolved column index is usable. Throws otherwise. */
export function requireColumn(index, context = {}) {
  if (typeof index !== 'number' || !Number.isInteger(index) || index < 0) {
    throw new SheetParseError('Could not resolve required column from sheet headers', context);
  }
  return index;
}

const MONTH_ABBR = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];

/**
 * Convert a month name plus a Pakistani fiscal year to a calendar YYYY-MM.
 * Pakistan's FY runs July-June, so Jul-Dec belong to the previous calendar year.
 */
export function fiscalMonthToYearMonth(monthName, fiscalYear) {
  const idx = MONTH_ABBR.indexOf(String(monthName).slice(0, 3).toLowerCase());
  if (idx < 0) return null;
  const fy = parseFiscalYear(fiscalYear);
  if (fy === null) return null;
  const calendarYear = idx >= 6 ? fy - 1 : fy;
  return `${calendarYear}-${String(idx + 1).padStart(2, '0')}`;
}

/**
 * Every publicly displayed figure carries one of these so the UI can show a
 * complete citation. Keep the shape stable - the UI and the audit both read it.
 */
export function provenance({
  institution,
  document: doc,
  documentUrl = null,
  sheet = null,
  location = null,
  period = null,
  status = 'final',
  retrievedAt = null,
  sourceType = 'official-primary',
  note = null,
}) {
  if (!institution) throw new SheetParseError('provenance requires an institution');
  if (!doc) throw new SheetParseError('provenance requires a document');
  return {
    institution,
    document: doc,
    documentUrl,
    sheet,
    location,
    period,
    status,
    sourceType,
    retrievedAt: retrievedAt || new Date().toISOString().slice(0, 10),
    note,
  };
}
