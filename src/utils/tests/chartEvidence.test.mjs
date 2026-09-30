import test from 'node:test';
import assert from 'node:assert/strict';
import { chartEvidenceFor, pointEvidenceRow } from '../chartEvidence.js';
import { chartToCsv } from '../download.js';
import { chartHasFigures } from '../figureTrust.js';
import { selectChartRange } from '../chartTimeRange.js';
import { sparklineSegments } from '../sparkline.js';

const rows = [
  { date: '2025-01', status: 'final', evidence: { path: '/source-evidence/prior.xlsx', locator: { row: 2 } } },
  { date: '2026-01', status: 'provisional', evidence: { path: '/source-evidence/current.xlsx', locator: { row: 9 } } },
];

test('comparison evidence binds to its prior period, not the current label', () => {
  const options = { evidenceRows: rows, observationDates: ['2026-01'], label: 'Jan 26' };
  assert.deepEqual(chartEvidenceFor({ label: 'Current' }, 0, options).rows, [rows[1]]);
  assert.deepEqual(chartEvidenceFor({ label: 'Prior', isComparison: true }, 0, options).rows, [rows[0]]);
  assert.equal(chartEvidenceFor({ label: 'FY25 prior', isComparison: true }, 0, options).period, '2025-01');
  assert.equal(chartEvidenceFor({ label: 'FY26 current' }, 0, { ...options, label: 'Jul' }).period, '2025-07');
});

test('series value fields bind tables and CSV to one native API column and its source-stated status', () => {
  const row = { date: '2026-01', total: 100, usa: 0, evidence: {
    total: rows[1].evidence, usa: { path: '/source-evidence/usa.json', locator: { seriesKey: 'usa', observationDate: '2026-01-31' } },
  }, observations: { total: { status: 'revised' }, usa: { status: 'provisional' } } };
  const series = { label: 'USA', valueField: 'usa', data: [0] };
  const result = chartEvidenceFor(series, 0, { evidenceRows: [row], observationDates: ['2026-01'] });
  assert.equal(result.rows[0].evidence.path, '/source-evidence/usa.json');
  assert.equal(result.rows[0].status, 'provisional');
  const csv = chartToCsv({ labels: ['Jan 26'], datasets: [series] }, { evidenceRows: [row], observationDates: ['2026-01'] });
  assert.ok(csv.includes('usa.json'));
  assert.ok(!csv.includes('current.xlsx'));
  assert.ok(csv.includes('provisional'));
});

test('explicit series dates and evidence remain aligned when chart ranges slice points', () => {
  const data = { labels: ['Jan 25', 'Jan 26'], datasets: [{ label: 'Current', data: [1, 2], observationDates: ['2025-01', '2026-01'], evidenceRows: rows }] };
  const selected = selectChartRange(data, ['2025-01', '2026-01'], '1y');
  assert.deepEqual(selected.data.datasets[0].evidenceRows, [rows[1]]);
  assert.deepEqual(selected.data.datasets[0].observationDates, ['2026-01']);
});

test('CSV evidence distinguishes the current and prior series and serializes locators', () => {
  const csv = chartToCsv({ labels: ['Jan 26'], datasets: [{ label: 'Current', data: [1] },
    { label: 'Prior', isComparison: true, data: [2] }] }, { evidenceRows: rows, observationDates: ['2026-01'] });
  assert.ok(csv.includes('Current (2026-01): provisional'));
  assert.ok(csv.includes('Prior (2025-01): final'));
  assert.ok(csv.includes('prior.xlsx'));
  assert.ok(!csv.includes('[object Object]'));
});

test('missing comparison evidence stays missing rather than reusing another observation', () => {
  assert.deepEqual(chartEvidenceFor({ isComparison: true }, 0, { evidenceRows: [rows[1]], observationDates: ['2026-01'] }).rows, []);
});

test('fiscal source years bind to annual chart categories independently of plotting end dates', () => {
  const annual = [{ year: 'FY2025', evidence: rows[0].evidence }, { year: 'FY2026', evidence: rows[1].evidence }];
  const options = { evidenceRows: annual, observationDates: ['2026-06-30'], label: 'FY26' };
  assert.deepEqual(chartEvidenceFor({ label: 'GDP growth' }, 0, options).rows, [annual[1]]);
  assert.deepEqual(chartEvidenceFor({ label: 'Prior year', isComparison: true }, 0, options).rows, [annual[0]]);
});

test('cumulative and mixed series retain every exact input rather than another series or the endpoint alone', () => {
  const sourceRows = [{ date: '2026-07', evidence: rows[0].evidence }, { date: '2026-08', evidence: rows[1].evidence }];
  const series = { label: 'Cumulative imports', data: [1, 3], observationDates: sourceRows.map((row) => row.date),
    evidenceRows: [[sourceRows[0]], sourceRows], derivation: 'Sum of monthly imports' };
  assert.deepEqual(chartEvidenceFor(series, 1).rows, sourceRows);
  const csv = chartToCsv({ labels: ['Jul 26', 'Aug 26'], datasets: [series] }, { evidenceRows: sourceRows });
  assert.ok(csv.includes('Evidence observation periods'));
  assert.ok(csv.includes('2026-07 | 2026-08'));
  assert.ok(csv.includes('Sum of monthly imports'));
  const selected = selectChartRange({ labels: ['Jul 26', 'Aug 26'], datasets: [series] }, sourceRows.map((row) => row.date), '1y');
  assert.equal(selected.data.datasets[0].evidenceRows[1].length, 2);
  const fiscalSeries = { label: 'Expenditure', evidenceRows: [[{ fy: 'FY2026', evidence: rows[1].evidence }]] };
  assert.equal(chartEvidenceFor(fiscalSeries, 0, { evidenceRows: [{ fy: 'FY2026', evidence: rows[0].evidence }] }).rows[0].evidence.path, '/source-evidence/current.xlsx');
});

test('point comparisons never borrow the current column evidence or status for prior or FYTD values', () => {
  const row = { name: 'IT services', latestMonth: '2026-01', yearAgoMonth: '2025-01',
    status: 'provisional', evidence: rows[1].evidence, yearAgoEvidence: rows[0].evidence };
  const current = pointEvidenceRow(row, 'latest', row.latestMonth);
  const prior = pointEvidenceRow(row, 'yearAgo', row.yearAgoMonth);
  assert.equal(current.evidence.path, '/source-evidence/current.xlsx');
  assert.equal(prior.evidence.path, '/source-evidence/prior.xlsx');
  assert.equal(prior.status, 'unknown');
  assert.equal(pointEvidenceRow(row, 'fytdPrior', 'Jul-Aug FY2025').evidence, undefined);
  assert.equal(chartEvidenceFor({ evidenceRows: [prior], isComparison: true }, 0,
    { observationDates: [row.latestMonth], label: row.name }).period, row.yearAgoMonth);
});

test('sparklines keep missing positions and draw disconnected segments', () => {
  const segments = sparklineSegments([1, 2, null, 4, 5]);
  assert.deepEqual(segments.map((segment) => segment.length), [2, 2]);
  assert.equal(segments[0][0].x, 2);
  assert.equal(segments[1][0].x, 74);
  assert.deepEqual(sparklineSegments([null, undefined]), []);
});

test('empty/null/non-finite charts are unavailable while genuine zero remains plotted', () => {
  for (const data of [[], [null], [NaN], [Infinity]]) assert.equal(chartHasFigures({ labels: ['Jan'], datasets: [{ data }] }), false);
  assert.equal(chartHasFigures({ labels: ['Jan'], datasets: [{ data: [0] }] }), true);
});
