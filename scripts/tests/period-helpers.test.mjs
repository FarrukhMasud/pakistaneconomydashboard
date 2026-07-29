import test from 'node:test';
import assert from 'node:assert/strict';
import {
  latestRow,
  previousRow,
  isFiniteNumber,
  deriveFiscalLabels,
  currentFiscalYear,
  buildFytdSeries,
  formatMonthYear,
} from '../../src/utils/periodHelpers.js';

test('latestRow and previousRow handle empty and short arrays', () => {
  assert.equal(latestRow(null), null);
  assert.equal(latestRow([]), null);
  assert.equal(previousRow([{ date: '2025-01' }]), null);
  assert.deepEqual(latestRow([{ date: '2025-01' }, { date: '2025-02' }]), { date: '2025-02' });
  assert.deepEqual(previousRow([{ date: '2025-01' }, { date: '2025-02' }]), { date: '2025-01' });
});

test('isFiniteNumber rejects nullish and NaN', () => {
  assert.equal(isFiniteNumber(0), true);
  assert.equal(isFiniteNumber(12.5), true);
  assert.equal(isFiniteNumber(null), false);
  assert.equal(isFiniteNumber(undefined), false);
  assert.equal(isFiniteNumber(Number.NaN), false);
  assert.equal(isFiniteNumber('12'), false);
});

test('deriveFiscalLabels follows Jul–Jun SBP convention', () => {
  const fromMar = deriveFiscalLabels('2026-03-01');
  assert.equal(fromMar.fyLabel, 'FY26');
  assert.equal(fromMar.priorLabel, 'FY25');
  assert.equal(fromMar.fyFull, 'FY2026');

  const fromOct = deriveFiscalLabels('2025-10-15');
  assert.equal(fromOct.fyLabel, 'FY26');

  const fromRows = deriveFiscalLabels([
    { date: '2025-07' },
    { date: '2025-12' },
  ]);
  assert.equal(fromRows.fyLabel, 'FY26');
});

test('currentFiscalYear builds FYTD windows from data', () => {
  const rows = [
    { date: '2024-07', v: 1 },
    { date: '2024-08', v: 2 },
    { date: '2025-07', v: 3 },
    { date: '2025-08', v: 4 },
    { date: '2025-09', v: 5 },
  ];
  const fy = currentFiscalYear(rows);
  assert.equal(fy.fyLabel, 'FY26');
  assert.equal(fy.months, 3);
  assert.equal(fy.prior.length, 2);
});

test('formatMonthYear is timezone-safe', () => {
  assert.equal(formatMonthYear('2025-01'), 'Jan 25');
  assert.equal(formatMonthYear('2025-12-31'), 'Dec 25');
});

test('buildFytdSeries aligns prior FY months and keeps null gaps', () => {
  const rows = [
    { date: '2024-07', total: 10 },
    { date: '2024-08', total: 12 },
    { date: '2024-09', total: 14 },
    { date: '2025-07', total: 20 },
    { date: '2025-08', total: 22 },
    // missing prior for September intentionally via absent 2024-09 wait we have it
    { date: '2025-09', total: 24 },
  ];
  const series = buildFytdSeries(rows, 'total');
  assert.equal(series.currentLabel, 'FY26');
  assert.equal(series.priorLabel, 'FY25');
  assert.deepEqual(series.current, [20, 22, 24]);
  assert.deepEqual(series.prior, [10, 12, 14]);
  assert.equal(series.labels.length, 3);

  const withGap = buildFytdSeries([
    { date: '2024-07', total: 10 },
    { date: '2025-07', total: 20 },
    { date: '2025-08', total: 22 },
  ], 'total');
  assert.deepEqual(withGap.prior, [10, null]);
});
