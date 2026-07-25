/**
 * Unit tests for the pure sheet helpers.
 *
 * Run with: npm test
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import {
  parseFiscalYear,
  latestFiscalYear,
  forwardFill,
  findRowIndex,
  requireRowIndex,
  requireColumn,
  fiscalMonthToYearMonth,
  SheetParseError,
} from '../lib/sheet-utils.mjs';

test('parseFiscalYear understands SBP fiscal-year tokens', () => {
  assert.equal(parseFiscalYear('FY26'), 2026);
  assert.equal(parseFiscalYear('FY26 (P)'), 2026);
  assert.equal(parseFiscalYear('July-May FY26 (P)'), 2026);
  assert.equal(parseFiscalYear('FY 09'), 2009);
  assert.equal(parseFiscalYear('FY99'), 1999);
  assert.equal(parseFiscalYear('26'), 2026);
  assert.equal(parseFiscalYear('2026'), 2026);
  assert.equal(parseFiscalYear('May-2026(P)'), null);
  assert.equal(parseFiscalYear(''), null);
  assert.equal(parseFiscalYear(null), null);
});

test('latestFiscalYear picks the highest year in a header row', () => {
  assert.equal(latestFiscalYear(['Country', 'FY24', 'FY25', 'FY26 (P)']), 2026);
  assert.equal(latestFiscalYear(['Country', null, '']), null);
});

test('forwardFill carries merged header labels across columns', () => {
  assert.deepEqual(
    forwardFill(['Country', 'Jul-Jun', null, 'May', null], 5),
    ['Country', 'Jul-Jun', 'Jul-Jun', 'May', 'May'],
  );
});

test('findRowIndex and requireRowIndex locate rows by label', () => {
  const rows = [['Header'], ['3. Transport'], ['4. Travel']];
  assert.equal(findRowIndex(rows, /^4\.\s*Travel/i), 2);
  assert.equal(findRowIndex(rows, /^99\. Nope/), -1);
  assert.equal(requireRowIndex(rows, /^3\.\s*Transport/i), 1);
  assert.throws(() => requireRowIndex(rows, /^99\. Nope/), SheetParseError);
});

test('requireColumn refuses unresolved columns instead of guessing', () => {
  assert.equal(requireColumn(7), 7);
  assert.throws(() => requireColumn(-1, { file: 'x.xls' }), SheetParseError);
  assert.throws(() => requireColumn(undefined), SheetParseError);
  assert.throws(() => requireColumn(null), SheetParseError);
});

test('fiscalMonthToYearMonth maps Pakistani fiscal months to calendar months', () => {
  // FY2026 runs July 2025 through June 2026.
  assert.equal(fiscalMonthToYearMonth('Jul', 'FY26'), '2025-07');
  assert.equal(fiscalMonthToYearMonth('Dec', 'FY26'), '2025-12');
  assert.equal(fiscalMonthToYearMonth('Jan', 'FY26'), '2026-01');
  assert.equal(fiscalMonthToYearMonth('Jun', 'FY26'), '2026-06');
  assert.equal(fiscalMonthToYearMonth('Nope', 'FY26'), null);
});
