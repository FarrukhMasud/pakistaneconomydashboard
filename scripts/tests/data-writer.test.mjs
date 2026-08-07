/**
 * Tests for freshness semantics and the revision log.
 */

import test from 'node:test';
import assert from 'node:assert/strict';

import { __test__ } from '../lib/data-writer.mjs';

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
  const after = { x: 100.00001 };
  assert.deepEqual(collectRevisions(before, after), []);
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
