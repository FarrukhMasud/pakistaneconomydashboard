import test from 'node:test';
import assert from 'node:assert/strict';
import { applyShareableChartState, parseShareableChartState, shareableChartSearch } from '../../src/hooks/useShareableChartState.js';
import {
  chartSummary, fiscalYearEndDate, mergeObservationDates, normalizeChartRange, observationTime, selectChartRange, valuesByDate, visibleChartData,
} from '../../src/utils/chartTimeRange.js';
import { chartToCsv } from '../../src/utils/download.js';
import { applySeriesFocus } from '../../src/utils/seriesFocus.js';

const monthlyDates = Array.from({ length: 73 }, (_, index) => {
  const date = new Date(Date.UTC(2020, index, 1));
  return date.toISOString().slice(0, 7);
});
const makeData = (dates) => ({
  labels: dates,
  datasets: [
    { label: 'Current', data: dates.map((_, index) => index), backgroundColor: dates.map((_, index) => `color-${index}`) },
    { label: 'Prior year', isComparison: true, data: dates.map((_, index) => index - 12), borderDash: [6, 3] },
  ],
});

test('tables and CSV retain the selected observations and exclude unfocused series without mutating the chart', () => {
  const original = makeData(monthlyDates);
  original.datasets[1].hidden = true;
  const selected = selectChartRange(original, monthlyDates, '1y');
  const exported = visibleChartData(selected.data);
  assert.equal(exported.labels.length, 12);
  assert.equal(exported.datasets.length, 1);
  assert.equal(exported.datasets[0].label, 'Current');
  assert.equal(selected.data.datasets.length, 2);
  assert.equal(original.labels.length, 73);
  assert.doesNotMatch(chartToCsv(exported), /Prior year/);
  assert.equal(chartToCsv(selected.data), chartToCsv(exported), 'the export utility itself must exclude hidden series too');
});

test('monthly windows are exactly 12, 36 and 60 calendar months ending at the latest observation', () => {
  const original = makeData(monthlyDates);
  for (const [range, expected] of [['1y', 12], ['3y', 36], ['5y', 60], ['all', 73]]) {
    const selected = selectChartRange(original, monthlyDates, range);
    assert.equal(selected.data.labels.length, expected);
    assert.equal(selected.data.labels.at(-1), '2026-01');
    assert.equal(selected.data.datasets[0].data.length, expected);
    assert.equal(selected.data.datasets[1].data.length, expected);
    assert.equal(selected.data.datasets[0].backgroundColor[0], `color-${73 - expected}`);
    assert.deepEqual(selected.data.datasets[1].borderDash, [6, 3]);
    assert.equal(chartToCsv(selected.data).trim().split('\n').length, expected + 1);
  }
  assert.equal(original.labels.length, 73);
  assert.equal(original.datasets[0].data.length, 73);
});

test('missing periods do not pull older observations into a calendar window, and null gaps stay aligned', () => {
  const dates = ['2024-12', '2025-01', '2025-02', '2025-10', '2026-01', '2026-02'];
  const data = makeData(dates);
  data.datasets[0].data = [4, 5, null, 7, 8, null];
  const selected = selectChartRange(data, dates, '1y');
  assert.deepEqual(selected.dates, ['2025-02', '2025-10', '2026-01']);
  assert.deepEqual(selected.data.datasets[0].data, [null, 7, 8]);
  assert.deepEqual(selected.data.datasets[1].data, [-10, -9, -8]);
  assert.equal(selected.data.labels.at(-1), '2026-01', 'a future comparison value is not an actual observation');
});

test('weekly windows use a calendar-year boundary, including leap-day handling', () => {
  const dates = ['2024-02-23', '2024-02-29', '2024-03-07', '2025-02-28'];
  assert.deepEqual(selectChartRange(makeData(dates), dates, '1y').dates, dates.slice(1));
  const leap = ['2023-02-28', '2023-03-01', '2024-02-29'];
  assert.deepEqual(selectChartRange(makeData(leap), leap, '1y').dates, leap.slice(1));
  const weekly = Array.from({ length: 160 }, (_, index) => new Date(Date.UTC(2023, 0, 6 + index * 7)).toISOString().slice(0, 10));
  assert.equal(selectChartRange(makeData(weekly), weekly, '1y').dates.length, 53);
});

test('fiscal curves, annual fiscal labels, categories, malformed and unsorted dates never get sliced', () => {
  for (const mode of ['fiscal', 'category', 'comparison']) {
    const data = makeData(monthlyDates);
    const selected = selectChartRange(data, monthlyDates, '1y', mode);
    assert.equal(selected.data, data);
    assert.equal(selected.range, 'all');
    assert.equal(selected.applicable, false);
  }
  for (const dates of [
    ['FY2024', 'FY2025'], ['Jul', 'Aug'], ['China', 'UK'], ['2025-02-30', '2025-03-01'],
    ['2025-03', '2025-02'], ['2025-01', '2025-01'], ['2025-13'],
  ]) {
    const data = makeData(dates);
    assert.equal(selectChartRange(data, dates, '1y').data, data);
    assert.equal(selectChartRange(data, dates, '1y').applicable, false);
  }
  assert.equal(observationTime('2024-02-29'), Date.UTC(2024, 1, 29));
  assert.equal(observationTime('2023-02-29'), null);
});

test('explicitly annual fiscal histories can opt into date windows without interpreting FYTD categories as dates', () => {
  const labels = ['FY2021', 'FY2022', 'FY2023', 'FY2024', 'FY2025', 'FY2026'];
  const dates = labels.map(fiscalYearEndDate);
  assert.deepEqual(selectChartRange(makeData(labels), dates, '3y').data.labels, labels.slice(-3));
  assert.equal(selectChartRange(makeData(labels), dates, '1y').data.labels.length, 1);
  assert.equal(fiscalYearEndDate('FY26'), '2026-06-30');
  assert.equal(fiscalYearEndDate('Jul-Jun FY2026'), null);
  assert.equal(fiscalYearEndDate('Jul'), null);
});

test('range and comparison patches preserve other chart state, language, embed and unrelated URL fields', () => {
  const initial = '?lang=ur&embed=1&series=1&compare=yoy&range=3y';
  const compare = applyShareableChartState(initial, { compare: 'fytd' }, 'yoy');
  assert.deepEqual(parseShareableChartState(compare, 'yoy'), { compare: 'fytd', focus: 1, range: '3y' });
  const range = applyShareableChartState(compare, { range: 'all' });
  const focus = applyShareableChartState(range, { focus: 0 });
  assert.deepEqual(parseShareableChartState(focus, 'yoy'), { compare: 'fytd', focus: 0, range: 'all' });
  assert.equal(new URLSearchParams(focus).get('lang'), 'ur');
  assert.equal(new URLSearchParams(focus).get('embed'), '1');
  assert.equal(new URLSearchParams(focus).get('range'), 'all', 'explicit All overrides a chart default of 3Y');
});

test('malformed URLs fall back without inventing valid series indices or range values', () => {
  for (const value of ['', '-1', '1.5', 'NaN', 'Infinity', '0x1', '1e2', '9007199254740992']) {
    assert.equal(parseShareableChartState(`?series=${value}`).focus, null);
  }
  for (const value of ['', '1Y', '0y', '100y', 'NaN']) {
    assert.equal(parseShareableChartState(`?range=${value}`, 'yoy', '3y').range, '3y');
  }
  assert.deepEqual(parseShareableChartState('?compare=unknown&range=5y'), { compare: 'off', focus: null, range: '5y' });
  assert.equal(normalizeChartRange('unknown', 'invalid'), 'all');
});

test('legacy hash share links hydrate before route canonicalization without dropping language or chart state', () => {
  const search = shareableChartSearch({ search: '?lang=ur', hash: '#/external/reserves?compare=off&range=1y&series=1' });
  assert.deepEqual(parseShareableChartState(search, 'yoy'), { compare: 'off', range: '1y', focus: 1 });
  assert.equal(new URLSearchParams(search).get('lang'), 'ur');
  assert.equal(shareableChartSearch({ search: '?range=3y', hash: '#chart-imports?range=1y' }), 'range=3y');
});

test('mode changes use the full FY/category comparison and restore the chosen chronological window', () => {
  const data = makeData(monthlyDates);
  const chronological = selectChartRange(data, monthlyDates, '3y');
  const fiscal = selectChartRange(data, monthlyDates, '3y', 'fiscal');
  const restored = selectChartRange(data, monthlyDates, '3y');
  assert.equal(fiscal.data.labels.length, 73);
  assert.deepEqual(restored.data, chronological.data);
  assert.equal(restored.data.labels.length, 36);
});

test('independent series align by date without shifting or estimating missing values', () => {
  const first = [{ date: '2025-01', value: 10 }, { date: '2025-03', value: 30 }];
  const second = [{ date: '2025-02', value: 20 }, { date: '2025-03', value: null }];
  const dates = mergeObservationDates(first, second);
  assert.deepEqual(dates, ['2025-01', '2025-02', '2025-03']);
  assert.deepEqual(valuesByDate(dates, first), [10, null, 30]);
  assert.deepEqual(valuesByDate(dates, second), [null, 20, null]);
});

test('accessible summaries use the filtered periods, actual values and visible series', () => {
  const data = makeData(monthlyDates);
  data.datasets[1].hidden = true;
  const selected = selectChartRange(data, monthlyDates, '1y');
  const text = chartSummary(selected.data, { t: (_, fallback) => fallback, unit: 'USD Millions' });
  assert.match(text, /2025-02 to 2026-01/);
  assert.match(text, /Current: 72 \(2026-01\)/);
  assert.match(text, /Units: USD Millions/);
  assert.doesNotMatch(text, /Prior year/);
  assert.match(text, /Data & sources/);
});

test('out-of-bounds series URLs cannot hide every chart series', () => {
  const data = makeData(monthlyDates);
  assert.equal(applySeriesFocus(data.datasets, 999), data.datasets);
  assert.equal(applySeriesFocus(data.datasets, -1), data.datasets);
  assert.equal(applySeriesFocus(data.datasets, 0)[1].hidden, true);
});

test('category summaries identify a meaningful leading value rather than pretending categories are dates', () => {
  const text = chartSummary({
    labels: ['China', 'UK', 'Canada'],
    datasets: [{ label: 'Imports', data: [500, 200, 50] }],
  }, { t: (_, fallback) => fallback, categorical: true, coverage: 'FY2026' });
  assert.match(text, /3 categories shown/);
  assert.match(text, /Largest magnitude: Imports: 500 \(China\)/);
  assert.match(text, /FY2026/);
  assert.doesNotMatch(text, /China to Canada/);
});
