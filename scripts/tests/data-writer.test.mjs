/**
 * Tests for freshness semantics and the revision log.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { __test__, validateNumericValues } from '../lib/data-writer.mjs';

const { collectRevisions, stripVolatile, rowKeyOf } = __test__;

test('collectRevisions reports restatements of existing values', () => {
  const before = { fytd: { net: 2267.33 } };
  const after = { fytd: { net: 1623.28 } };
  assert.deepEqual(collectRevisions(before, after), [
    { path: 'fytd.net', from: 2267.33, to: 1623.28 },
  ]);
});

test('collectRevisions ignores newly added values', () => {
  const before = { monthly: [{ date: '2026-05', net_fdi: 214 }] };
  const after = {
    monthly: [
      { date: '2026-05', net_fdi: 214 },
      { date: '2026-06', net_fdi: 14 },
    ],
  };
  assert.deepEqual(collectRevisions(before, after), []);
});

test('collectRevisions matches observations by date, not by array position', () => {
  const before = { monthly: [{ date: '2026-05', net_fdi: 214 }] };
  // A new month is prepended AND May is revised — position matching would miss it.
  const after = {
    monthly: [
      { date: '2026-04', net_fdi: 180 },
      { date: '2026-05', net_fdi: 209 },
    ],
  };
  assert.deepEqual(collectRevisions(before, after), [
    { path: 'monthly[date=2026-05].net_fdi', from: 214, to: 209 },
  ]);
});

test('collectRevisions treats a KPI period advance as a new observation', () => {
  const before = {
    indicators: [{ id: 'fbr-tax', period: 'Jul–May FY2026', value: 11.23 }],
  };
  const after = {
    indicators: [{ id: 'fbr-tax', period: 'Jul–Jun FY2026', value: 13 }],
  };
  assert.deepEqual(collectRevisions(before, after), []);
});

test('collectRevisions ignores floating-point noise', () => {
  const before = { x: 100 };
  const after = { x: 100 + Number.EPSILON * 64 };
  assert.deepEqual(collectRevisions(before, after), []);
});

test('small genuine restatements are preserved', () => {
  assert.deepEqual(collectRevisions({ x: 100 }, { x: 100.00001 }), [
    { path: 'x', from: 100, to: 100.00001 },
  ]);
});

test('aggregate period advances are new observations, not revisions', () => {
  assert.deepEqual(collectRevisions(
    { fytd: { period: 'Jul-Aug FY27', net: 12 } },
    { fytd: { period: 'Jul-Sep FY27', net: 20 } },
  ), []);
});

test('evidence checks do not create analytical revisions', () => {
  assert.deepEqual(collectRevisions(
    { evidence: { bytes: 10 }, value: 2 },
    { evidence: { bytes: 20 }, value: 2 },
  ), []);
});

test('canonical writes reject non-finite values and broken periods', () => {
  assert.throws(() => validateNumericValues({ value: NaN }), /non-finite/);
  assert.throws(() => validateNumericValues({ value: Infinity }), /non-finite/);
  assert.throws(() => validateNumericValues({ period: 'null FY27' }), /invalid reporting period/);
  assert.doesNotThrow(() => validateNumericValues({ value: null, period: 'Jul-Aug FY27' }));
});

test('collectRevisions ignores volatile bookkeeping keys', () => {
  const before = { lastUpdated: '2026-07-01', lastChecked: '2026-07-01', value: 5 };
  const after = { lastUpdated: '2026-07-24', lastChecked: '2026-07-24', value: 5 };
  assert.deepEqual(collectRevisions(before, after), []);
});

test('stripVolatile makes freshness metadata irrelevant to change detection', () => {
  const a = { lastUpdated: '2026-01-01', b: 1, a: 2 };
  const b = { lastChecked: '2026-07-24', a: 2, b: 1 };
  assert.equal(JSON.stringify(stripVolatile(a)), JSON.stringify(stripVolatile(b)));
});

test('rowKeyOf prefers date-like identity keys', () => {
  assert.equal(rowKeyOf({ date: '2026-06', v: 1 }), 'date=2026-06');
  assert.equal(rowKeyOf({ country: 'China', amount: 1 }), 'country=China');
  assert.equal(rowKeyOf({ amount: 1 }), null);
  assert.equal(rowKeyOf(5), null);
});

test('country observations match country and year, never a shared annual date', () => {
  const before = { values: [{ countryCode: 'PAK', year: 2025, value: 3.7 }, { countryCode: 'VNM', year: 2025, value: 8.02 }] };
  assert.deepEqual(collectRevisions(before, { values: [...before.values].reverse() }), []);
  const after = { values: [{ countryCode: 'VNM', year: 2025, value: 8.02 }, { countryCode: 'PAK', year: 2025, value: 3.8 }] };
  assert.deepEqual(collectRevisions(before, after), [{ path: 'values[countryCode=PAK,year=2025].value', from: 3.7, to: 3.8 }]);
});

test('a newer weekly sample in the same monthly bucket is not an issuer restatement', () => {
  assert.deepEqual(collectRevisions(
    { data: [{ date: '2026-09', observationDate: '2026-09-18', value: 100 }] },
    { data: [{ date: '2026-09', observationDate: '2026-09-25', value: 101 }] },
  ), []);
});
