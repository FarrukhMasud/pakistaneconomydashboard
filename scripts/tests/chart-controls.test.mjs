import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Line } from 'react-chartjs-2';
import { createServer } from 'vite';
import { countryFlagPlugin } from '../../src/utils/countryLabels.js';
import { selectChartRange } from '../../src/utils/chartTimeRange.js';
import { applySeriesFocus } from '../../src/utils/seriesFocus.js';
import { chartToCsv } from '../../src/utils/download.js';
import { fytdDisabledReason } from '../../src/utils/periodHelpers.js';

let server;
let ChartCard;
let ChartDataTable;
let PeriodCompare;
let TradeSection;
let TradeLatestSummary;
let I18nContext;
let translate;
let translateString;

before(async () => {
  server = await createServer({ server: { middlewareMode: true, hmr: false }, appType: 'custom', logLevel: 'error' });
  const chartModule = await server.ssrLoadModule('/src/components/ChartCard.jsx');
  ChartCard = chartModule.default;
  ChartDataTable = chartModule.ChartDataTable;
  PeriodCompare = (await server.ssrLoadModule('/src/components/ui/PeriodCompare.jsx')).default;
  const tradeModule = await server.ssrLoadModule('/src/components/TradeSection.jsx');
  TradeSection = tradeModule.default;
  TradeLatestSummary = tradeModule.TradeLatestSummary;
  const i18n = await server.ssrLoadModule('/src/i18n/context.js');
  ({ I18nContext, translate, translateString } = i18n);
});
after(async () => { await server?.close(); });

const dates = ['2024-01', '2025-01', '2026-01'];
const data = { labels: dates, datasets: [{ label: 'Imports', data: [10, null, 30] }] };

test('shared chart renders an accessible canvas, actual-data summary and a discoverable data/source disclosure', () => {
  const html = renderToStaticMarkup(createElement(ChartCard, {
    title: 'Trade chart',
    dataSource: 'SBP',
    dataCoverage: 'Jan 2026',
    observationDates: dates,
    coverageNote: 'Detailed tables lag the headline.',
  }, createElement(Line, { data })));
  assert.match(html, /<canvas[^>]*role="img"[^>]*aria-label="Trade chart"/);
  assert.match(html, /<h3 id="chart-trade-chart" tabindex="-1" data-chart-anchor="true">Trade chart<\/h3>/);
  assert.match(html, /role="region" aria-labelledby="chart-trade-chart"/);
  assert.match(html, /aria-describedby="[^"]+-summary-0"/);
  assert.match(html, /Imports: 30 \(2026-01\)/);
  assert.match(html, /class="chart-essential-context"/);
  assert.match(html, /<summary>Data &amp; sources<\/summary>/);
  assert.match(html, />Show data table<\/button>/);
  assert.match(html, />Download CSV<\/button>/);
  assert.match(html, /aria-label="Last 1 year"/);
  assert.match(html, /aria-label="Last 3 years"/);
  assert.match(html, /aria-label="Last 5 years"/);
  assert.match(html, /aria-label="All available history"/);
  assert.ok(html.indexOf('Detailed tables lag') > html.indexOf('<details class="chart-data-sources"'));
});

test('fiscal overlays have no misleading range controls and retain the complete comparison', () => {
  const html = renderToStaticMarkup(createElement(ChartCard, {
    title: 'FY comparison', observationDates: dates, rangeMode: 'fiscal',
  }, createElement(Line, { data })));
  assert.doesNotMatch(html, /class="chart-range-controls"/);
  assert.match(html, /Full comparison period shown/);
  assert.match(html, /Shown: 2024-01 to 2026-01/);
});

test('essential chart periods use full observation years rather than abbreviated labels or future comparison values', () => {
  for (const [observationDates, labels, expected] of [
    [['2026-06', '2026-07', '2026-08'], ['Jun 26', 'Jul 26', 'Aug 26'], 'Jul 2026'],
    [['2026-07-24', '2026-07-31', '2026-08-07'], ['24 Jul 26', '31 Jul 26', '7 Aug 26'], '31 Jul 2026'],
    [['2024-06-30', '2025-06-30', '2026-06-30'], ['FY24', 'FY25', 'FY26'], 'FY2025'],
  ]) {
    const html = renderToStaticMarkup(createElement(ChartCard, {
      title: 'Full periods', dataSource: 'SBP', dataCoverage: labels.at(-1), observationDates,
    }, createElement(Line, {
      data: {
        labels,
        datasets: [
          { label: 'Actual', data: [1, 2, null] },
          { label: 'Comparison', data: [10, 20, 30], isComparison: true },
        ],
      },
    })));
    assert.ok(html.includes(`<span class="latest-period-badge">Latest: ${expected}</span>`));
    assert.ok(html.includes(`<span>Latest available period: ${expected}</span>`));
    assert.match(html, /<span>Source: SBP<\/span>/);
  }
});

test('deep chart anchors use original titles before translation and support stable explicit overrides', () => {
  const translate = {
    t: (key, fallback) => fallback || key,
    tx: () => 'Localized title',
  };
  const render = (props) => renderToStaticMarkup(createElement(I18nContext.Provider, { value: translate },
    createElement(ChartCard, { title: 'Imports vs Exports', ...props }, createElement(Line, { data })),
  ));
  assert.match(render(), /<h3 id="chart-imports-vs-exports" tabindex="-1" data-chart-anchor="true">Localized title<\/h3>/);
  assert.match(render({ chartId: 'chart-fixed-title' }), /<h3 id="chart-fixed-title" tabindex="-1" data-chart-anchor="true">Localized title<\/h3>/);
});

test('chronological ticks use human-readable dates rather than raw millisecond timestamps or stale category indices', () => {
  function TickProbe({ options }) {
    const label = options.scales.x.ticks.callback.call({
      getLabelForValue: (value) => value === 1769904000000 ? 'Feb 2026' : 'unexpected date',
    }, 1769904000000);
    return createElement('output', null, label);
  }
  const html = renderToStaticMarkup(createElement(ChartCard, {
    title: 'Date axis', observationDates: dates,
  }, createElement(TickProbe, { data })));
  assert.match(html, /<output>Feb 2026<\/output>/);
});

test('disabled comparisons explain their unavailable state inline and link the button to the reason', () => {
  const reason = 'Needs at least three matching fiscal months.';
  const html = renderToStaticMarkup(createElement(PeriodCompare, {
    mode: 'off', onChange: () => {}, disabledModes: { fytd: reason }, note: reason,
  }));
  assert.match(html, /Compare with last year/);
  assert.match(html, /Compare fiscal year to date/);
  assert.match(html, /disabled="" aria-describedby="[^"]+-fytd"/);
  assert.match(html, /<p id="[^"]+-fytd" class="period-compare__note">Compare fiscal year to date: Needs at least three matching fiscal months\.<\/p>/);
  assert.equal((html.match(/class="period-compare__note"/g) || []).length, 1);
});

test('table and direct CSV export apply series focus and the same date window, including restoring all series', () => {
  const periods = Array.from({ length: 24 }, (_, index) => new Date(Date.UTC(2024, index, 1)).toISOString().slice(0, 7));
  const original = {
    labels: periods,
    datasets: [
      { label: 'Unfocused', data: periods.map((_, index) => index) },
      { label: 'Focused', data: periods.map((_, index) => index === 18 ? null : 1000 + index) },
      { label: 'Comparison', isComparison: true, data: periods.map(() => 9999) },
    ],
  };
  const selected = selectChartRange({
    ...original, datasets: applySeriesFocus(original.datasets, 1),
  }, periods, '1y').data;
  const html = renderToStaticMarkup(createElement(ChartDataTable, { chartData: selected, caption: 'Visible observations' }));
  const csv = chartToCsv(selected);
  assert.match(html, /<th scope="col">Focused<\/th>/);
  assert.ok(html.includes(`<th scope="row">2025-01</th><td>${(1012).toLocaleString()}</td>`));
  assert.match(html, /<th scope="row">2025-07<\/th><td>\u2014<\/td>/);
  assert.doesNotMatch(html, /Unfocused|Comparison|9,999/);
  assert.equal((html.match(/<th scope="row">/g) || []).length, 12);
  assert.equal(csv.trim().split('\n').length, 13);
  assert.match(csv, /^Period,Focused\n2025-01,1012\n/);
  assert.match(csv, /\n2025-07,\n/);
  assert.doesNotMatch(csv, /Unfocused|Comparison|9999/);
  assert.equal(original.datasets.length, 3);
  assert.equal(original.datasets[0].hidden, undefined);
  assert.equal(original.labels.length, 24);
  const restored = selectChartRange({
    ...original, datasets: applySeriesFocus(original.datasets, null),
  }, periods, '1y').data;
  assert.match(chartToCsv(restored), /^Period,Unfocused,Focused,Comparison\n/);
});

test('every fiscal comparison disabled reason is rendered inline in Urdu with translated plain labels', () => {
  const reasons = [
    fytdDisabledReason(null),
    fytdDisabledReason({ rows: [{ date: '2026-07' }], elapsedMonths: 1 }),
    fytdDisabledReason({ rows: [{ date: '2026-04' }], elapsedMonths: 10 }),
  ];
  const translations = {
    lang: 'ur',
    t: (key, fallback) => translate('ur', key, fallback),
    tx: (text) => translateString('ur', text),
  };
  for (const reason of reasons) {
    const translatedReason = translations.tx(reason);
    assert.notEqual(translatedReason, reason);
    assert.match(translatedReason, /\p{Script=Arabic}/u);
    const html = renderToStaticMarkup(createElement(I18nContext.Provider, { value: translations },
      createElement(PeriodCompare, { mode: 'off', onChange: () => {}, disabledModes: { fytd: reason }, note: reason }),
    ));
    const inlineReason = html.match(/<p id="[^"]+-fytd" class="period-compare__note">([\s\S]*?)<\/p>/)?.[1];
    assert.ok(inlineReason?.includes(translatedReason));
    assert.ok(!html.includes(reason));
    assert.ok(!html.includes('Compare with last year'));
    assert.ok(!html.includes('Compare fiscal year to date'));
    assert.equal((html.match(/class="period-compare__note"/g) || []).length, 1);
  }
});

test('late country flag loads do not redraw a chart destroyed by a route or focus-view change', () => {
  const priorImage = globalThis.Image;
  const images = [];
  globalThis.Image = class {
    constructor() { images.push(this); }
  };
  try {
    let draws = 0;
    const chart = {
      ctx: {},
      scales: { y: { ticks: [{ value: 0 }] } },
      draw: () => { draws += 1; },
    };
    countryFlagPlugin(['China'], 'test').afterDraw(chart);
    assert.equal(images.length, 1);
    images[0].onload();
    assert.equal(draws, 1);
    chart.ctx = null;
    images[0].onload();
    assert.equal(draws, 1);
  } finally {
    if (priorImage === undefined) delete globalThis.Image;
    else globalThis.Image = priorImage;
  }
});

test('Trade latest-month summary keeps three headline values, period and source visible without a disclosure', () => {
  const html = renderToStaticMarkup(createElement(TradeLatestSummary, {
    row: { date: '2026-07', exports: 3008, imports: 6154, balance: -3146 },
  }));
  assert.match(html, /Latest month: Jul 2026/);
  assert.match(html, /<dt>Exports<\/dt><dd>3\.0B<\/dd>/);
  assert.match(html, /<dt>Imports<\/dt><dd>6\.2B<\/dd>/);
  assert.match(html, /<dt>Trade balance<\/dt><dd>-3\.1B<\/dd>/);
  assert.equal((html.match(/<dd>/g) || []).length, 3);
  assert.match(html, /USD; M = million, B = billion/);
  assert.match(html, /Source: SBP/);
  assert.doesNotMatch(html, /<details|hidden=/);
});

test('Trade keeps the latest-month metrics before both main charts and annual summaries and coverage after them', async (context) => {
  const cache = await server.ssrLoadModule('/src/hooks/dataCache.js');
  const payload = {
    monthly: [
      { date: '2025-07', exports: 2000, imports: 4500, balance: -2500 },
      { date: '2026-07', exports: 3008, imports: 6154, balance: -3146 },
    ],
    dataCoverage: 'Jul 26',
    lastUpdated: '2026-08-19',
  };
  context.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => payload }));
  try {
    assert.equal((await cache.loadData('trade.json')).error, null);
    const html = renderToStaticMarkup(createElement(TradeSection));
    const headline = html.indexOf('class="card trade-latest-summary"');
    const mainCharts = html.indexOf('class="section-grid trade-main-charts"');
    const balanceChart = html.indexOf('id="chart-trade-balance"');
    const coverage = html.indexOf('class="trade-coverage-short"');
    const annualSummaries = html.indexOf('class="summary-pair trade-period-context"');
    assert.ok(headline >= 0 && mainCharts > headline);
    assert.ok(balanceChart > mainCharts && coverage > balanceChart);
    assert.ok(annualSummaries > coverage);
    const annualContext = html.slice(annualSummaries, html.indexOf('class="trade-coverage-details"'));
    assert.equal((annualContext.match(/class="summary-card__title"/g) || []).length, 2);
    assert.match(annualContext, /Calendar YTD/);
    assert.match(annualContext, /First month/);
    assert.match(html.slice(headline, mainCharts), /Source: SBP/);
    assert.equal((html.slice(headline, mainCharts).match(/<dd>/g) || []).length, 3);
    assert.match(html, /Latest available period: Jul 2026/);
  } finally {
    cache.__resetDataCache();
  }
});

test('Trade latest-month summary does not turn an unpublished metric into zero or mix another month into the headline', () => {
  const html = renderToStaticMarkup(createElement(TradeLatestSummary, {
    row: { date: '2026-08', exports: 3100, imports: null, balance: null },
  }));
  assert.match(html, /Latest month: Aug 2026/);
  assert.match(html, /<dt>Imports<\/dt><dd>—<\/dd>/);
  assert.match(html, /<dt>Trade balance<\/dt><dd>—<\/dd>/);
  assert.doesNotMatch(html, /<dd>0/);
});
