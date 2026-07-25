import test from 'node:test';
import assert from 'node:assert/strict';

import {
  periodEndDate,
  observedInterval,
  observedPublicationLag,
  buildReleaseRow,
  sortReleaseRows,
} from '../lib/release-calendar.mjs';

test('periodEndDate expands a month label to the last calendar day', () => {
  assert.equal(periodEndDate('2026-06'), '2026-06-30');
  assert.equal(periodEndDate('2026-02'), '2026-02-28');
  assert.equal(periodEndDate('2024-02'), '2024-02-29');
  assert.equal(periodEndDate('2026-07-17'), '2026-07-17');
  assert.equal(periodEndDate('FY2026'), null);
  assert.equal(periodEndDate(undefined), null);
});

test('observedInterval measures monthly spacing', () => {
  const months = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06'];
  const result = observedInterval(months);
  assert.equal(result.lastObservationEnd, '2026-06-30');
  assert.ok(result.days >= 28 && result.days <= 31, `expected ~monthly, got ${result.days}`);
  assert.equal(result.samples, 5);
});

test('observedInterval uses the current granularity when a series mixes month-end and weekly points', () => {
  // This is exactly the SBP reserves shape: month-end history, then weekly
  // points once the current month opens. Averaging both regimes would push the
  // next weekly release a month into the future.
  const mixed = [
    '2025-06', '2025-07', '2025-08', '2025-09', '2025-10', '2025-11', '2025-12',
    '2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06',
    '2026-07-03', '2026-07-10', '2026-07-17',
  ];
  const result = observedInterval(mixed);
  assert.equal(result.days, 7);
  assert.equal(result.lastObservationEnd, '2026-07-17');
});

test('observedInterval refuses to guess from fewer than three observations', () => {
  assert.equal(observedInterval(['2026-05', '2026-06']), null);
  assert.equal(observedInterval([]), null);
  assert.equal(observedInterval(undefined), null);
  assert.equal(observedInterval(['FY2024', 'FY2025', 'FY2026']), null);
});

test('observedPublicationLag rejects negative and backfill-sized lags', () => {
  assert.equal(observedPublicationLag('2026-06-30', '2026-07-24T00:00:00.000Z'), 24);
  assert.equal(observedPublicationLag('2026-06-30', '2026-06-01T00:00:00.000Z'), null);
  assert.equal(observedPublicationLag('2025-01-31', '2026-07-24T00:00:00.000Z'), null);
  assert.equal(observedPublicationLag(null, '2026-07-24T00:00:00.000Z'), null);
});

const monthlyDataset = {
  id: 'trade',
  label: 'Trade in Goods',
  cadence: 'Monthly',
  source: 'State Bank of Pakistan',
  sourceUrl: 'https://example.invalid/trade',
  sourceType: 'official-primary',
  critical: true,
  observations: data => data.monthly.map(row => row.date),
};

function monthlyData(lastMonths = ['2026-01', '2026-02', '2026-03', '2026-04', '2026-05', '2026-06']) {
  return { monthly: lastMonths.map(date => ({ date })) };
}

test('buildReleaseRow projects the next monthly release and states its basis', () => {
  const row = buildReleaseRow({
    dataset: monthlyDataset,
    data: monthlyData(),
    freshness: { latestObservation: '2026-06', dashboardUpdated: '2026-07-24T00:00:00.000Z' },
    now: new Date('2026-07-24T00:00:00Z'),
  });

  assert.equal(row.schedule, 'estimated');
  assert.equal(row.status, 'scheduled');
  assert.equal(row.publicationLagDays, 24);
  assert.equal(row.expectedNextObservation, '2026-07-30');
  assert.equal(row.expectedRelease, '2026-08-23');
  assert.ok(row.windowEnd > row.expectedRelease);
  assert.match(row.basis, /Estimated/);
  assert.match(row.basis, /Not an official release calendar/);
});

test('buildReleaseRow flags a stalled series as overdue with the days late', () => {
  const row = buildReleaseRow({
    dataset: monthlyDataset,
    data: monthlyData(['2025-08', '2025-09', '2025-10', '2025-11', '2025-12', '2026-01']),
    freshness: { latestObservation: '2026-01', dashboardUpdated: '2026-02-20T00:00:00.000Z' },
    now: new Date('2026-07-24T00:00:00Z'),
  });

  assert.equal(row.status, 'overdue');
  assert.ok(row.daysLate > 90, `expected a large overdue count, got ${row.daysLate}`);
});

test('buildReleaseRow prefers a date announced by the source over any projection', () => {
  const row = buildReleaseRow({
    dataset: {
      ...monthlyDataset,
      id: 'monetary-policy',
      label: 'SBP Policy Rate Tracker',
      cadence: 'Event-driven',
      announcedNext: data => data.nextMeeting,
      observations: () => [],
    },
    data: { nextMeeting: { date: null, dateText: 'Expected late-July 2026', note: 'SBP announces the calendar in July.' } },
    freshness: { latestObservation: '2026-06-15', dashboardUpdated: '2026-06-17T00:00:00.000Z' },
    now: new Date('2026-07-24T00:00:00Z'),
  });

  assert.equal(row.schedule, 'announced');
  assert.equal(row.expectedReleaseText, 'Expected late-July 2026');
  assert.equal(row.status, 'scheduled');
  assert.match(row.basis, /Announced by the source/);
});

test('buildReleaseRow falls back to event-driven rather than inventing a date', () => {
  const row = buildReleaseRow({
    dataset: {
      ...monthlyDataset,
      id: 'external-debt',
      label: 'External Debt',
      cadence: 'Event-driven',
      expectedLag: 'Update when SBP/MoF disclose revised figures.',
      observations: () => [],
    },
    data: {},
    freshness: { latestObservation: '2026-06-17', dashboardUpdated: '2026-06-17T00:00:00.000Z' },
    now: new Date('2026-07-24T00:00:00Z'),
  });

  assert.equal(row.schedule, 'event-driven');
  assert.equal(row.expectedRelease, null);
  assert.equal(row.status, 'event-driven');
  assert.equal(row.daysLate, 0);
});

test('sortReleaseRows puts overdue first and event-driven last', () => {
  const rows = [
    { id: 'a', label: 'A', status: 'scheduled', expectedRelease: '2026-09-01' },
    { id: 'b', label: 'B', status: 'event-driven', expectedRelease: null },
    { id: 'c', label: 'C', status: 'overdue', expectedRelease: '2026-03-01' },
    { id: 'd', label: 'D', status: 'due', expectedRelease: '2026-07-20' },
    { id: 'e', label: 'E', status: 'scheduled', expectedRelease: '2026-08-01' },
  ];
  assert.deepEqual(sortReleaseRows(rows).map(r => r.id), ['c', 'd', 'e', 'a', 'b']);
});
