import test from 'node:test';
import assert from 'node:assert/strict';
import {
  latestRow,
  previousRow,
  isFiniteNumber,
  deriveFiscalLabels,
  currentFiscalYear,
  buildFytdSeries,
  buildYoYOverlay,
  buildMonthlyComparisonFromSeries,
  preferNewerMonthlyComparison,
  formatMonthYear,
  formatFySummaryTitle,
  isClosedFiscalPeriod,
  isThinFiscalYear,
  isSparseFiscalYear,
  fytdViewReady,
  resolveCompareMode,
  fbrCollectionLabel,
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
  assert.equal(fy.elapsedMonths, 3);
  assert.equal(fy.prior.length, 2);
  assert.equal(fy.rangeLabel, 'Jul 2025 – Sep 2025');
});

test('July-only FY is labelled as a first month and treated as too thin for FYTD charts', () => {
  const fy = currentFiscalYear([
    { date: '2025-07', net: 10 },
    { date: '2026-07', net: 12 },
  ]);
  assert.equal(fy.fyLabel, 'FY27');
  assert.equal(fy.elapsedMonths, 1);
  assert.equal(fy.months, 1);
  assert.equal(fy.rangeLabel, 'Jul 2026');
  assert.equal(isThinFiscalYear(fy), true);
  assert.equal(fytdViewReady(fy), false);
  assert.equal(resolveCompareMode('fytd', fy), 'yoy');
  assert.equal(formatFySummaryTitle(fy), 'FY27 · Jul 2026 only — First month');
});

test('sparse FY windows are not chart-ready even when the calendar span is long', () => {
  const fy = currentFiscalYear([
    { date: '2025-07', net: 754 },
    { date: '2026-01', net: 1015 },
  ]);
  assert.equal(fy.fyLabel, 'FY26');
  assert.equal(fy.elapsedMonths, 7);
  assert.equal(fy.months, 2);
  assert.equal(isSparseFiscalYear(fy), true);
  assert.equal(fytdViewReady(fy), false);
  assert.equal(resolveCompareMode('fytd', fy), 'yoy');
});

test('closed Jul–Jun periods are not labelled FYTD', () => {
  assert.equal(isClosedFiscalPeriod('Jul–Jun FY2026'), true);
  assert.equal(isClosedFiscalPeriod('Jul-Jun FY26'), true);
  assert.equal(isClosedFiscalPeriod('Jul–Jan FY2027'), false);
  assert.equal(
    fbrCollectionLabel({ period: 'Jul–Jun FY2026', fyLabel: 'FY2026' }),
    'FBR Tax Collection (FY2026)',
  );
});

test('monthly comparison prefers the later monthly-series month over a stale workbook cut', () => {
  const derived = buildMonthlyComparisonFromSeries([
    { date: '2025-07', net_fdi: 223 },
    { date: '2026-07', net_fdi: 179 },
  ], 'net_fdi');
  assert.equal(derived.month, 'Jul');
  assert.equal(derived.current.net_fdi, 179);
  assert.equal(derived.prior.net_fdi, 223);

  const chosen = preferNewerMonthlyComparison({
    month: 'May',
    current: { label: 'FY2026', net_fdi: 214 },
    prior: { label: 'FY2025', net_fdi: 232 },
  }, derived);
  assert.equal(chosen.month, 'Jul');
  assert.equal(chosen.source, 'monthly-series');
});

test('YoY overlay does not pair weekly dates with a prior monthly stamp when matchGrain is on', () => {
  const rows = [
    { date: '2025-07', sbp: 14000 },
    { date: '2026-07-10', sbp: 17200 },
  ];
  const loose = buildYoYOverlay(rows, 'sbp');
  assert.equal(loose.priorData[1], 14000);
  const strict = buildYoYOverlay(rows, 'sbp', { matchGrain: true });
  assert.equal(strict.priorData[1], null);
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
