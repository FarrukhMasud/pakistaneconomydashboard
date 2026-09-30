import test from 'node:test';
import assert from 'node:assert/strict';

import { getDatasetFreshness, DATASETS } from '../data-catalog.mjs';

test('verification dates never replace the economic observation date', () => {
  const result = getDatasetFreshness(
    {
      id: 'test',
      label: 'Test dataset',
      cadence: 'event-driven',
      sourceType: 'official',
      latest: (data) => data.observationDate,
    },
    {
      observationDate: '2026-05-08',
      publicationDate: '2026-05-08',
      lastVerified: '2026-08-07',
      lastUpdated: '2026-05-08',
    },
  );

  assert.equal(result.latestObservation, '2026-05-08');
  assert.equal(result.observationDate, '2026-05-08');
  assert.equal(result.publicationDate, '2026-05-08');
  assert.equal(result.verificationDate, '2026-08-07');
  assert.equal(result.dashboardUpdated, '2026-05-08');
});

const dataset = {
  id: 'series', label: 'Series', cadence: 'Monthly', sourceType: 'official-primary',
  sourceFile: 'official.json', latest: data => data.monthly?.at(-1)?.date,
  observations: data => data.monthly?.map(row => row.date) || [],
};

test('mixed fiscal freshness uses the newest supported period without ageing GDP and finance together', () => {
  const descriptor = DATASETS.find(item => item.id === 'fiscal');
  const result = getDatasetFreshness(descriptor, {
    annual: [{ year: 'FY2026', gdpGrowth: 3.7 }],
    publicFinance: { fiscal_balance: { data: [{ date: '2025-06-30', value: -3 }] } },
  });
  assert.equal(result.observationDate, '2026-06-30');
  assert.equal(result.series.find(item => item.id === 'gdp-growth').observationDate, '2026-06-30');
  assert.equal(result.series.find(item => item.id === 'publicFinance.fiscal_balance').observationDate, '2025-06-30');
});

test('authenticity, freshness, and validation are independent claims', () => {
  const result = getDatasetFreshness(dataset, {
    monthly: [{ date: '2026-08', value: 1 }], sourceEvidence: { artifactId: 'receipt', sha256: 'a'.repeat(64), sourceUrl: 'https://www.sbp.org.pk/example' },
  }, { now: new Date('2026-09-30') });
  assert.equal(result.authenticity, 'official-primary');
  assert.equal(result.freshnessStatus, 'latest-available');
  assert.equal(result.validation.status, 'pending');
});

test('failed fetches do not acquire a fresh success badge from old cached values', () => {
  const result = getDatasetFreshness(dataset, { monthly: [{ date: '2026-08' }] }, {
    now: new Date('2026-09-30'), checks: { 'official.json': { status: 'failed', checkedAt: '2026-09-30' } },
  });
  assert.equal(result.freshnessStatus, 'fetch-failed');
  assert.equal(result.sourceCheck, 'failed');
});

test('estimated overdue calendars do not prove a newer official release exists', () => {
  const result = getDatasetFreshness(dataset, {
    monthly: ['2026-04', '2026-05', '2026-06', '2026-07', '2026-08'].map(date => ({ date })),
  }, { now: new Date('2026-10-20') });
  assert.equal(result.releaseExpectation, 'overdue');
  assert.equal(result.releaseSchedule, 'estimated');
  assert.equal(result.freshnessStatus, 'latest-available');
});

test('withheld datasets expose no observation series or primary-source badge', () => {
  const result = getDatasetFreshness(dataset, {
    monthly: [{ date: '2026-08' }], publication: { policy: 'official-only', status: 'withheld', reason: 'No evidence' },
  });
  assert.equal(result.authenticity, 'unavailable');
  assert.equal(result.observationDate, null);
  assert.deepEqual(result.series, []);
});

test('identical event-driven documents can be verified without changing their retrieval date', () => {
  const result = getDatasetFreshness({ ...dataset, cadence: 'Event-driven' }, {
    monthly: [{ date: '2026-05' }], lastChecked: '2026-05-01',
    sourceEvidence: { artifactId: 'receipt', sourceKey: 'official.json', retrievedAt: '2026-05-01' },
  }, { now: new Date('2026-09-30'), checks: { 'official.json': { status: 'success', checkedAt: '2026-09-30T01:00:00Z' } } });
  assert.equal(result.freshnessStatus, 'latest-available');
  assert.equal(result.verificationDate, '2026-09-30T01:00:00Z');
});

test('a null CPI row cannot advance the latest actual observation', () => {
  const result = getDatasetFreshness(DATASETS.find(item => item.id === 'inflation'), {
    national_cpi: { data: [{ date: '2026-05', value: 2 }, { date: '2026-08', value: null }] },
  }, { now: new Date('2026-09-30') });
  assert.equal(result.latestObservation, '2026-05');
  assert.equal(result.freshnessStatus, 'overdue');
});

test('a current total cannot hide a stale corridor series', () => {
  const result = getDatasetFreshness(DATASETS.find(item => item.id === 'remittances'), {
    monthly: [
      { date: '2026-05', total: 1, saudiArabia: 1 },
      { date: '2026-08', total: 2, saudiArabia: null },
    ],
  }, { now: new Date('2026-09-30') });
  assert.equal(result.freshnessStatus, 'latest-available');
  assert.equal(result.series.find(row => row.id === 'saudiArabia').status, 'overdue');
});
