/**
 * Golden-file tests for SBP workbook header resolution.
 *
 * The fixtures in fixtures/sbp-headers.json are the *real* header rows captured
 * from the SBP workbooks the pipeline downloads. Each test asserts:
 *
 *   1. the resolver picks the correct column on today's published layout, and
 *   2. it still picks the correct column when the fiscal year rolls forward
 *      (the failure mode that previously caused the parser to silently fall
 *      back to column 7), and
 *   3. it throws rather than guessing when the expected headers are absent.
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

import {
  classifyCountryColumns,
  resolveFdiSectorColumns,
  resolveFdiCountryColumns,
  resolveServicesColumns,
  fyMonthToYearMonth,
  EBOPS_ROW_PATTERNS,
} from '../lib/sbp-resolvers.mjs';
import { requireRowIndex, SheetParseError } from '../lib/sheet-utils.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = JSON.parse(
  readFileSync(resolve(__dirname, 'fixtures', 'sbp-headers.json'), 'utf-8'),
);

/** Rebuild a sparse `rows` array from the captured {rowIndex: cells} fixture. */
function toRows(fixture) {
  const rows = [];
  for (const [idx, cells] of Object.entries(fixture.rows)) rows[Number(idx)] = cells;
  return rows;
}

/** Bump every "FYnn" token in a fixture by `delta` years, simulating a rollover. */
function shiftFiscalYears(value, delta) {
  if (Array.isArray(value)) return value.map((v) => shiftFiscalYears(v, delta));
  if (typeof value === 'string') {
    return value.replace(/FY\s*(\d{2})/gi, (_m, yy) =>
      `FY${String((Number(yy) + delta) % 100).padStart(2, '0')}`,
    );
  }
  return value;
}

// ─────────────────────────────────────────────────────────────
// Export / import by country — the previous /FY26/ + column-7 bug
// ─────────────────────────────────────────────────────────────

for (const key of ['exportByCountry', 'importByCountry']) {
  const fixture = FIXTURES[key];

  test(`${key}: resolves the current fiscal-year-to-date column from real headers`, () => {
    const cols = classifyCountryColumns(toRows(fixture));
    assert.equal(cols.curFullFY, 2026);
    assert.equal(cols.fytdCur, 7, 'Jul-May FY26 (P) is column 7 in the published file');
    assert.equal(cols.fytdPrior, 6, 'Jul-May FY25 is column 6');
    assert.equal(cols.fytdLabel, 'Jul-May');
    assert.equal(cols.latest, 5, 'May (P) FY26 is the latest month column');
    assert.equal(cols.prev, 4, 'Apr (R) FY26 is the prior month column');
    assert.equal(cols.yearAgo, 3, 'May FY25 is the year-ago month column');
    assert.equal(cols.latestMonth, '2026-05');
    assert.equal(cols.yearAgoMonth, '2025-05');
  });

  test(`${key}: keeps working after the fiscal year rolls over`, () => {
    // Regression guard. The old implementation searched for a hardcoded "FY26"
    // and silently fell back to column 7, so an FY27 file would have published
    // the FY26 column as if it were current.
    const rows = toRows(fixture).map((r) => shiftFiscalYears(r, 1));
    const cols = classifyCountryColumns(rows);
    assert.equal(cols.curFullFY, 2027);
    assert.equal(cols.fytdCur, 7);
    assert.equal(cols.fytdPrior, 6);
    assert.equal(cols.latestMonth, '2027-05');
  });

  test(`${key}: throws instead of guessing when the fiscal year headers vanish`, () => {
    const rows = toRows(fixture);
    rows[5] = rows[5].map(() => null);
    assert.throws(() => classifyCountryColumns(rows), SheetParseError);
  });
}

// ─────────────────────────────────────────────────────────────
// FDI by sector (Foreign_Dir.xls / BS_M)
// ─────────────────────────────────────────────────────────────

test('fdiSector: resolves inflow/outflow/net triplets for current and prior FY', () => {
  const rows = toRows(FIXTURES.fdiSector);
  const cols = resolveFdiSectorColumns(rows[2]);
  assert.equal(cols.fiscalYear, 2026);
  assert.deepEqual(
    { in: cols.current.inflow, out: cols.current.outflow, net: cols.current.net },
    { in: 4, out: 5, net: 6 },
  );
  assert.deepEqual(
    { in: cols.prior.inflow, out: cols.prior.outflow, net: cols.prior.net },
    { in: 7, out: 8, net: 9 },
  );
  assert.equal(cols.current.status, 'provisional');
  assert.equal(cols.current.period, 'July-May FY26');
  // The sub-header row must actually label these columns Inflow/Outflow/Net FDI.
  assert.match(String(rows[3][cols.current.net]), /net/i);
});

test('fdiSector: survives a fiscal-year rollover and never picks the prior year as current', () => {
  const rows = toRows(FIXTURES.fdiSector).map((r) => shiftFiscalYears(r, 1));
  const cols = resolveFdiSectorColumns(rows[2]);
  assert.equal(cols.fiscalYear, 2027);
  assert.equal(cols.current.net, 6);
  assert.equal(cols.prior.net, 9);
});

test('fdiSector: throws when the period headers are missing', () => {
  assert.throws(() => resolveFdiSectorColumns(['Sectors', null, null]), SheetParseError);
});

// ─────────────────────────────────────────────────────────────
// FDI by country (Netinflow.xls / Country)
// ─────────────────────────────────────────────────────────────

test('fdiCountry: finds the Net column inside each fiscal-year block', () => {
  const rows = toRows(FIXTURES.fdiCountry);
  const cols = resolveFdiCountryColumns(rows[3], rows[4], rows[5]);
  assert.equal(cols.fiscalYear, 2026);
  // "Net" lives in row 5, two columns into each FDI block — the previous
  // implementation only searched row 4 and silently fell back to hardcoded 9/14.
  assert.equal(cols.current.net, 9);
  assert.equal(cols.prior.net, 14);
  assert.match(String(rows[5][cols.current.net]), /^net$/i);
  assert.match(String(rows[5][cols.prior.net]), /^net$/i);
});

test('fdiCountry: throws when the Net sub-header is absent', () => {
  const rows = toRows(FIXTURES.fdiCountry);
  const blanked = rows[5].map((v) => (/^net$/i.test(String(v || '')) ? 'Whatever' : v));
  assert.throws(
    () => resolveFdiCountryColumns(rows[3], rows[4], blanked),
    SheetParseError,
  );
});

// ─────────────────────────────────────────────────────────────
// FDI summary (NetinflowSummary.xls / Summary)
// ─────────────────────────────────────────────────────────────

test('fdiSummary: locates the Direct Investment rows by label, not by index', () => {
  const rows = toRows(FIXTURES.fdiSummary);
  const netIdx = requireRowIndex(rows, /^Direct\s+Investment$/i, { labelCol: 1 });
  const inflowIdx = requireRowIndex(rows, /^Inflow$/i, { labelCol: 3, from: netIdx, to: netIdx + 4 });
  const outflowIdx = requireRowIndex(rows, /^Outflow$/i, { labelCol: 3, from: netIdx, to: netIdx + 4 });
  assert.equal(netIdx, 8);
  assert.equal(inflowIdx, 9);
  assert.equal(outflowIdx, 10);
});

test('fdiSummary: current/prior FYTD are distinguished by the FY sub-header, not column order', () => {
  const rows = toRows(FIXTURES.fdiSummary);
  const header = rows[4];
  const sub = rows[5];
  const julMayCols = header
    .map((v, i) => (String(v || '').trim() === 'Jul-May' ? i : -1))
    .filter((i) => i >= 0);
  assert.equal(julMayCols.length, 1, 'the Jul-May block header is merged into one cell');
  const blockStart = julMayCols[0];
  // SBP prints the PRIOR year first and the current (P) year second. Reading
  // positionally produced a $2,267M headline when the true figure was $1,623M.
  assert.match(String(sub[blockStart]), /FY25/);
  assert.match(String(sub[blockStart + 1]), /FY26 \(P\)/);
});

// ─────────────────────────────────────────────────────────────
// Services / EBOPS (dt.xls)
// ─────────────────────────────────────────────────────────────

test('services: resolves current and prior cumulative columns by fiscal year', () => {
  const rows = toRows(FIXTURES.services);
  const cols = resolveServicesColumns(rows[6]);
  assert.equal(cols.current.fy, 2026);
  assert.equal(cols.prior.fy, 2025);
  assert.equal(cols.current.credit, 13);
  assert.equal(cols.prior.credit, 10);
  assert.equal(cols.current.label, 'Jul-May FY26');
  assert.ok(cols.month1 && cols.month2, 'both recent month blocks are resolved');
});

test('services: a rollover must not leave the prior year selected as current', () => {
  const rows = toRows(FIXTURES.services).map((r) => shiftFiscalYears(r, 1));
  const cols = resolveServicesColumns(rows[6]);
  assert.equal(cols.current.fy, 2027);
  assert.equal(cols.prior.fy, 2026);
  assert.equal(cols.current.credit, 13);
});

test('services: every EBOPS row we publish is findable by its own label', () => {
  const labelRows = FIXTURES.services.labels.map((l) => [l]);
  const resolved = {};
  for (const [key, pattern] of Object.entries(EBOPS_ROW_PATTERNS)) {
    resolved[key] = requireRowIndex(labelRows, pattern, { labelCol: 0 });
  }
  // Locking these in means an upstream row insert changes the test, not the
  // published numbers.
  assert.deepEqual(resolved, {
    totalServices: 8,
    transport: 13,
    travel: 33,
    insurance: 46,
    financial: 54,
    ipCharges: 57,
    itTelecom: 58,
    telecom: 59,
    computerServices: 62,
    softwareConsultancy: 64,
    softwareExportImport: 66,
    freelance: 67,
    informationServices: 69,
    otherBusiness: 72,
    personalCultural: 87,
  });
});

test('services: an inserted upstream row shifts the resolved index, not the mapping', () => {
  const labelRows = FIXTURES.services.labels.map((l) => [l]);
  labelRows.splice(10, 0, ['NEW SBP LINE']);
  assert.equal(requireRowIndex(labelRows, EBOPS_ROW_PATTERNS.transport, { labelCol: 0 }), 14);
  assert.equal(requireRowIndex(labelRows, EBOPS_ROW_PATTERNS.freelance, { labelCol: 0 }), 68);
});

// ─────────────────────────────────────────────────────────────
// GDP table
// ─────────────────────────────────────────────────────────────

test('gdp: growth row and year header row are found by label', () => {
  const rows = toRows(FIXTURES.gdp);
  const growthIdx = requireRowIndex(rows, /GDP\s+Growth\s+Rate/i, { labelCol: 2, to: 40 });
  const headerIdx = requireRowIndex(rows, /^\d{4}-\d{2,4}$/, { labelCol: 3, to: growthIdx + 1 });
  assert.equal(growthIdx, 5);
  assert.equal(headerIdx, 4);
  assert.equal(rows[headerIdx][3], '1999-2000');
});

// ─────────────────────────────────────────────────────────────
// Fiscal month arithmetic
// ─────────────────────────────────────────────────────────────

test('fyMonthToYearMonth handles the July fiscal-year boundary', () => {
  assert.equal(fyMonthToYearMonth('Jul', 26), '2025-07');
  assert.equal(fyMonthToYearMonth('Jun', 26), '2026-06');
  assert.equal(fyMonthToYearMonth('May', 26), '2026-05');
});
