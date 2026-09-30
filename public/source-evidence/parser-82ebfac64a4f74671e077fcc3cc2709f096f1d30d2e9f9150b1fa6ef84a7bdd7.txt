import { createHash } from 'node:crypto';
import { SheetParseError, parseFiscalYear, publicationStatus } from './sheet-utils.mjs';
import { hashContent } from './publication-policy.mjs';

export { publicationStatus };

const MONTHS = ['jan', 'feb', 'mar', 'apr', 'may', 'jun', 'jul', 'aug', 'sep', 'oct', 'nov', 'dec'];
const MONTH_PATTERN = '(?:Jan(?:uary)?|Feb(?:ruary)?|Mar(?:ch)?|Apr(?:il)?|May|Jun(?:e)?|Jul(?:y)?|Aug(?:ust)?|Sep(?:tember)?|Oct(?:ober)?|Nov(?:ember)?|Dec(?:ember)?)';
const MISSING = /^(?:\.{2,3}|--?|n\/?a|not available|not reported|suppressed|confidential|[sc])$/i;

export function sourceMissingReason(raw) {
  if (raw === null || raw === undefined || (typeof raw === 'string' && !raw.trim())) return 'not-reported';
  return MISSING.test(String(raw).trim()) ? 'source-unavailable' : null;
}

export function sourceNumber(raw, { required = true, context = 'source cell' } = {}) {
  if (raw === null || raw === undefined || (typeof raw === 'string' && !raw.trim())) {
    if (!required) return null;
    throw new SheetParseError('Missing required numeric value', { context });
  }
  if (typeof raw === 'string' && MISSING.test(raw.trim())) {
    if (!required) return null;
    throw new SheetParseError('Suppressed/unavailable required numeric value', { context, raw });
  }
  if (typeof raw === 'number' && Number.isFinite(raw)) return raw;
  if (typeof raw === 'string') {
    const text = raw.trim();
    if (/^[+-]?(?:(?:\d+|\d{1,3}(?:,\d{3})+)(?:\.\d*)?|\.\d+)$/.test(text)) {
      const value = Number(text.replaceAll(',', ''));
      if (Number.isFinite(value)) return value;
    }
  }
  throw new SheetParseError('Invalid numeric value', { context, raw });
}

export function calendarDate(raw, { monthly = false } = {}) {
  if (typeof raw !== 'string' || !/^\d{4}-\d{2}(?:-\d{2})?$/.test(raw)) {
    throw new SheetParseError('Invalid ISO observation date', { raw });
  }
  const [year, month, day] = raw.split('-').map(Number);
  if (year < 1900 || year > 2199 || month < 1 || month > 12 || (!monthly && day === undefined)) {
    throw new SheetParseError('Invalid calendar observation date', { raw });
  }
  if (day !== undefined) {
    const date = new Date(Date.UTC(year, month - 1, day));
    if (day < 1 || date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
      throw new SheetParseError('Invalid calendar observation date', { raw });
    }
  }
  return raw;
}

export function monthNumber(raw) {
  if (!new RegExp(`^${MONTH_PATTERN}$`, 'i').test(String(raw).trim())) {
    throw new SheetParseError('Invalid month label', { raw });
  }
  return MONTHS.indexOf(String(raw).trim().slice(0, 3).toLowerCase()) + 1;
}

export function fiscalYearRange(raw, { context = 'fiscal-year header' } = {}) {
  const match = typeof raw === 'string' && raw.trim().match(/^(\d{4})-(\d{2}|\d{4})(?:\s*\([PRF]\))?$/i);
  if (!match) throw new SheetParseError('Malformed fiscal year range', { context, raw });
  const firstYear = Number(match[1]);
  const fy = match[2].length === 4 ? Number(match[2])
    : Math.floor(firstYear / 100) * 100 + Number(match[2]) + (Number(match[2]) < firstYear % 100 ? 100 : 0);
  if (fy !== firstYear + 1 || parseFiscalYear(`FY${fy}`) === null) {
    throw new SheetParseError('Malformed fiscal year range', { context, raw });
  }
  return fy;
}

export function fiscalMonth(raw, fiscalYear) {
  const month = monthNumber(raw);
  const fy = parseFiscalYear(fiscalYear);
  if (fy === null) throw new SheetParseError('Invalid fiscal year', { fiscalYear });
  return calendarDate(`${month >= 7 ? fy - 1 : fy}-${String(month).padStart(2, '0')}`, { monthly: true });
}

export function fiscalWindow(raw, fiscalYear) {
  const text = String(raw ?? '').trim().replace(/\s*\([PRF]\)\s*$/i, '');
  const match = text.match(new RegExp(`^(Jul(?:y)?)(?:\\s*[-\\u2013]\\s*(${MONTH_PATTERN}))?(?:\\s*[,\\-]?\\s*FY\\s*(\\d{4}|\\d{2}))?$`, 'i'));
  if (!match) throw new SheetParseError('Invalid fiscal cumulative period', { raw });
  const fy = parseFiscalYear(fiscalYear ?? text);
  if (fy === null) throw new SheetParseError('Missing fiscal year for cumulative period', { raw });
  if (match[3] && parseFiscalYear(match[3]) !== fy) throw new SheetParseError('Conflicting fiscal years for cumulative period', { raw, fiscalYear });
  const endMonth = match[2] || match[1];
  return { start: fiscalMonth('Jul', fy), end: fiscalMonth(endMonth, fy), fiscalYear: fy };
}

export function calendarMonthLabel(raw) {
  const match = String(raw ?? '').trim().match(new RegExp(`^(${MONTH_PATTERN})[-\\s]+(\\d{2}|\\d{4})(?:\\s*\\([PRF]\\))?$`, 'i'));
  if (!match) throw new SheetParseError('Invalid calendar month label', { raw });
  const year = parseFiscalYear(match[2]);
  return calendarDate(`${year}-${String(monthNumber(match[1])).padStart(2, '0')}`, { monthly: true });
}

export function uniqueObservations(rows, key = 'date') {
  const seen = new Set();
  for (const row of rows) {
    if (seen.has(row[key])) throw new SheetParseError('Duplicate source observation', { [key]: row[key] });
    seen.add(row[key]);
  }
  return [...rows].sort((a, b) => String(a[key]).localeCompare(String(b[key])));
}

export function sumComplete(values) {
  if (!values.length || values.some(value => value === null || value === undefined)) return null;
  return values.reduce((sum, value) => sum + sourceNumber(value), 0);
}

export function requireSourceUnit(rows, expected) {
  const patterns = {
    'US$ million': /^(?=.*(?:US\s*\$|USD|US\s*dollars?|U\.S\.\s*dollars?))(?=.*(?:million|mln))[A-Za-z0-9.$%(), /-]+$/i,
    'PKR million': /^(?=.*(?:PKR|Rs\.?|rupees?))(?=.*(?:million|mln))[A-Za-z0-9.$%(), /-]+$/i,
    percent: /^(?:%|percent|percentage|per cent)(?:\s*(?:per annum|\(.*\)))?$/i,
  };
  const pattern = patterns[expected];
  if (!pattern || !rows.length || rows.some(row => !pattern.test(row.unit))) {
    throw new SheetParseError('Source unit does not match the required measure', { expected, units: [...new Set(rows.map(row => row.unit))] });
  }
  return rows;
}

export function assertReconciled(label, total, components, { tolerance = 0.02 } = {}) {
  const expected = sourceNumber(total, { context: label });
  const actual = sumComplete(components);
  if (actual === null || Math.abs(expected - actual) > tolerance) {
    throw new SheetParseError('Source reconciliation failed', { label, total: expected, components: actual, tolerance });
  }
  return { check: label, total: expected, components: actual, difference: expected - actual, tolerance, result: 'matched' };
}

export function compareEquivalent(label, left, right, { tolerance = 1 } = {}) {
  if (left.basis !== right.basis || left.unit !== right.unit) {
    throw new SheetParseError('Cannot reconcile different statistical bases or units', { label, left, right });
  }
  if (left.start !== right.start || left.end !== right.end) {
    return { check: label, result: 'not-comparable', reason: 'different-coverage', leftPeriod: [left.start, left.end], rightPeriod: [right.start, right.end] };
  }
  if (left.value === null || right.value === null) {
    return { check: label, result: 'not-comparable', reason: 'missing-observations', leftEvidence: left.evidence, rightEvidence: right.evidence };
  }
  return { ...assertReconciled(label, left.value, [right.value], { tolerance }), leftEvidence: left.evidence, rightEvidence: right.evidence };
}

export function officialUrl(raw) {
  const url = new URL(raw);
  if (url.protocol !== 'https:' || !/(?:^|\.)sbp\.org\.pk$/i.test(url.hostname) || url.username || url.password) {
    throw new SheetParseError('Source must be an official HTTPS SBP URL', { hostname: url.hostname });
  }
  for (const key of [...url.searchParams.keys()]) {
    if (/key|token|secret|password|credential|auth/i.test(key)) url.searchParams.delete(key);
  }
  url.hash = '';
  return url.toString();
}

export function verifyReceipt(receipt, bytes, sourceKey) {
  if (!receipt?.artifactId || !/^[a-f0-9]{64}$/i.test(receipt.sha256 ?? '') || receipt.sourceKey !== sourceKey) {
    throw new SheetParseError('Source parse requires an immutable artifact receipt', { sourceKey });
  }
  officialUrl(receipt.sourceUrl);
  officialUrl(receipt.responseUrl || receipt.sourceUrl);
  if (createHash('sha256').update(bytes).digest('hex') !== receipt.sha256) {
    throw new SheetParseError('Local source bytes do not match immutable artifact receipt', { sourceKey, artifactId: receipt.artifactId });
  }
  return receipt;
}

export function sourceEvidence(receipt, locator, extra = {}) {
  if (!receipt?.artifactId) throw new SheetParseError('Observation has no source artifact', { locator });
  return { artifactId: receipt.artifactId, sourceKey: receipt.sourceKey, retrievedAt: receipt.retrievedAt, locator, ...extra };
}

export function automatedPublicationRecord(
  { path, value, evidence, receipt, sourceBytes, status = 'not-stated' },
  { verifiedAutomatedClaims = {} } = {},
) {
  if (typeof path !== 'string' || !path || path.split('.').some(part => !part || part === '*')) {
    throw new SheetParseError('Automated evidence requires a concrete field path', { path });
  }
  if (typeof value !== 'number') {
    throw new SheetParseError('Automated evidence is restricted to parsed numeric fields, not manual text or whole payloads', { path });
  }
  sourceNumber(value, { context: path });
  if (!Buffer.isBuffer(sourceBytes) && !(sourceBytes instanceof Uint8Array)) {
    throw new SheetParseError('Automated evidence requires original archived source bytes', { path });
  }
  const verified = verifyReceipt(receipt, sourceBytes, evidence?.sourceKey);
  if (evidence?.artifactId !== verified.artifactId || !verified.parserVersion) {
    throw new SheetParseError('Automated evidence must reference its original parser-backed artifact', { path });
  }
  if (officialUrl(verified.sourceUrl) !== verified.sourceUrl
    || officialUrl(verified.responseUrl) !== verified.responseUrl) {
    throw new SheetParseError('Archived receipt URLs must be canonical and credential-free', { path });
  }
  const contentHash = hashContent(value);
  if (verifiedAutomatedClaims[path] !== contentHash) {
    throw new SheetParseError('Automated evidence requires independently reparsed archived-source confirmation', { path });
  }
  if (!['provisional', 'revised', 'final', 'estimate', 'not-stated'].includes(status)) {
    throw new SheetParseError('Unknown issuer publication status', { path, status });
  }
  const locator = evidence.locator;
  const coordinate = raw => Number.isInteger(raw) && raw >= 1;
  const tableCell = locator && coordinate(locator.row) && coordinate(locator.column);
  const excel = tableCell && typeof locator.sheet === 'string' && locator.sheet.trim()
    && locator.cell === `${excelCell(locator.column - 1)}${locator.row}`;
  const api = tableCell && locator.seriesKey === verified.sourceKey
    && typeof locator.observationDate === 'string' && locator.columns?.value === locator.column
    && Object.values(locator.columns).every(coordinate);
  const pdf = locator && coordinate(locator.page)
    && Number.isFinite(locator.x) && locator.x >= 0 && Number.isFinite(locator.y) && locator.y >= 0;
  if (!excel && !api && !pdf) {
    throw new SheetParseError('Automated evidence requires an exact source observation locator', { path, locator });
  }
  if (api) calendarDate(locator.observationDate);
  return {
    sourceType: 'official-primary', sourceKey: verified.sourceKey,
    artifactId: verified.artifactId, evidenceHash: verified.sha256,
    sourceUrl: verified.sourceUrl, location: JSON.stringify(locator),
    method: 'automated', contentHash, status,
  };
}

export function retainHistory(previous, incoming, key = 'date') {
  const history = new Map(uniqueObservations(previous, key).map(row => [row[key], row]));
  for (const row of uniqueObservations(incoming, key)) history.set(row[key], row);
  return [...history.values()].sort((a, b) => String(a[key]).localeCompare(String(b[key])));
}

export function retainFieldHistory(previous, incoming, fields) {
  const history = new Map(uniqueObservations(previous).map(row => [row.date, row]));
  for (const row of uniqueObservations(incoming)) {
    const older = history.get(row.date);
    if (!older) {
      history.set(row.date, row);
      continue;
    }
    const merged = { ...older, ...row, evidence: { ...older.evidence, ...row.evidence }, observations: { ...older.observations, ...row.observations } };
    for (const field of fields) if (!row.evidence[field]) merged[field] = older[field] ?? null;
    history.set(row.date, merged);
  }
  return [...history.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function excelCell(column) {
  let n = column + 1;
  let text = '';
  while (n > 0) {
    n--;
    text = String.fromCharCode(65 + n % 26) + text;
    n = Math.floor(n / 26);
  }
  return text;
}

const normalizeHeader = value => String(typeof value === 'object' ? value?.name ?? value?.label ?? '' : value).toLowerCase().replace(/[^a-z0-9]/g, '');
const API_HEADERS = {
  seriesKey: ['serieskey', 'seriesid', 'seriescode'],
  date: ['observationdate', 'obsdate'],
  value: ['observationvalue', 'obsvalue'],
  unit: ['unit', 'units', 'unitofmeasure'],
  status: ['status', 'observationstatus', 'obsstatus'],
  comments: ['comments', 'comment', 'observationcomments', 'statuscomments'],
};

export function parseApiSeries(raw, seriesKey, receipt) {
  if (receipt?.sourceKey !== seriesKey) throw new SheetParseError('API series does not match source receipt', { seriesKey });
  if (!Array.isArray(raw?.columns) || !Array.isArray(raw?.rows)) {
    throw new SheetParseError('SBP API requires explicit columns and rows', { seriesKey });
  }
  const indices = {};
  for (const [field, aliases] of Object.entries(API_HEADERS)) {
    const matches = raw.columns.map((column, index) => aliases.includes(normalizeHeader(column)) ? index : -1).filter(index => index >= 0);
    if (matches.length !== 1) throw new SheetParseError('Missing/ambiguous SBP API column', { seriesKey, field, columns: raw.columns });
    indices[field] = matches[0];
  }
  const rows = raw.rows.map((row, index) => {
    if (!Array.isArray(row) || row.length !== raw.columns.length || row[indices.seriesKey] !== seriesKey) {
      throw new SheetParseError('Unexpected SBP API row schema or series', { seriesKey, row: index + 1 });
    }
    const date = calendarDate(row[indices.date]);
    const unit = typeof row[indices.unit] === 'string' ? row[indices.unit].trim() : '';
    if (!unit) throw new SheetParseError('Missing source unit', { seriesKey, date });
    const sourceStatus = row[indices.status] ?? null;
    const comments = row[indices.comments] ?? null;
    if ((sourceStatus !== null && typeof sourceStatus !== 'string') || (comments !== null && typeof comments !== 'string')) {
      throw new SheetParseError('Invalid API status/comments', { seriesKey, date });
    }
    return {
      date, observationDate: date,
      value: sourceNumber(row[indices.value], { required: false, context: `${seriesKey} ${date}` }),
      unit, status: publicationStatus(sourceStatus), sourceStatus, comments,
      missingReason: sourceMissingReason(row[indices.value]),
      evidence: sourceEvidence(receipt, {
        seriesKey, observationDate: date, row: index + 1, column: indices.value + 1,
        columns: Object.fromEntries(Object.entries(indices).map(([field, column]) => [field, column + 1])),
      }, { rawValue: row[indices.value] }),
    };
  });
  if (!rows.length) throw new SheetParseError('SBP API returned no observations', { seriesKey });
  if (new Set(rows.map(row => row.unit)).size !== 1) throw new SheetParseError('Source unit changes within series', { seriesKey });
  return uniqueObservations(rows);
}

export function monthlyApiRows(rows, { weekly = false } = {}) {
  const byMonth = new Map();
  for (const row of uniqueObservations(rows)) {
    const date = row.date.slice(0, 7);
    if (!weekly && byMonth.has(date)) throw new SheetParseError('Duplicate source month', { date });
    byMonth.set(date, { ...row, date });
  }
  return [...byMonth.values()];
}

export function mergeApiFields(series, fields) {
  const byMonth = new Map();
  for (const [field, rows] of Object.entries(series)) {
    for (const row of monthlyApiRows(rows)) {
      if (!byMonth.has(row.date)) {
        byMonth.set(row.date, { date: row.date, ...Object.fromEntries(fields.map(key => [key, null])), evidence: {}, observations: {} });
      }
      const entry = byMonth.get(row.date);
      entry[field] = row.value;
      entry.evidence[field] = row.evidence;
      entry.observations[field] = { observationDate: row.observationDate, status: row.status, sourceStatus: row.sourceStatus, comments: row.comments, unit: row.unit, missingReason: row.missingReason };
    }
  }
  return [...byMonth.values()].sort((a, b) => a.date.localeCompare(b.date));
}

export function fdiMonthlyComparison(rows, previous = null) {
  const sorted = uniqueObservations(rows);
  if (!sorted.length) return previous;
  const latest = sorted.at(-1);
  const [year, month] = calendarDate(latest.date, { monthly: true }).split('-').map(Number);
  const prior = sorted.find(row => row.date === `${year - 1}-${String(month).padStart(2, '0')}`);
  const block = row => ({
    label: `FY${Number(row.date.slice(0, 4)) + (Number(row.date.slice(5, 7)) >= 7 ? 1 : 0)}`,
    date: row.date,
    ...Object.fromEntries(['net_fdi', 'equity', 'debt', 'inflow', 'outflow'].map(field => [field, sourceNumber(row[field], { required: false })])),
    status: row.observations?.net_fdi?.status ?? row.status ?? 'not-stated',
    sourceStatus: row.observations?.net_fdi?.sourceStatus ?? row.sourceStatus ?? null,
    evidence: row.evidence ?? {},
  });
  const comparison = {
    month: MONTHS[month - 1].replace(/^./, char => char.toUpperCase()),
    current: block(latest), prior: prior ? block(prior) : null, source: 'monthly-series',
  };
  if (previous) {
    const previousDate = previous.current?.date ?? fiscalMonth(previous.month, previous.current?.label);
    if (calendarDate(previousDate, { monthly: true }) > latest.date) return previous;
  }
  return comparison;
}

export function consecutiveMonths(rows, key = 'date', { allowGaps = false } = {}) {
  const sorted = uniqueObservations(rows, key);
  for (const row of sorted) calendarDate(row[key], { monthly: true });
  for (let i = 1; i < sorted.length; i++) {
    const [year, month] = calendarDate(sorted[i - 1][key], { monthly: true }).slice(0, 7).split('-').map(Number);
    const expected = new Date(Date.UTC(year, month, 1)).toISOString().slice(0, 7);
    if (sorted[i][key].slice(0, 7) !== expected) {
      if (allowGaps) return null;
      throw new SheetParseError('Non-contiguous monthly coverage', { expected, actual: sorted[i][key] });
    }
  }
  return sorted;
}
