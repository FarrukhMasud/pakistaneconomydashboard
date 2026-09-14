import test, { after, before } from 'node:test';
import assert from 'node:assert/strict';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { Line } from 'react-chartjs-2';
import { createServer } from 'vite';
import { countryFlagPlugin } from '../../src/utils/countryLabels.js';

let server;
let ChartCard;
let PeriodCompare;
let TradeLatestSummary;
let I18nContext;

before(async () => {
  server = await createServer({ server: { middlewareMode: true }, appType: 'custom', logLevel: 'error' });
  ChartCard = (await server.ssrLoadModule('/src/components/ChartCard.jsx')).default;
  PeriodCompare = (await server.ssrLoadModule('/src/components/ui/PeriodCompare.jsx')).default;
  TradeLatestSummary = (await server.ssrLoadModule('/src/components/TradeSection.jsx')).TradeLatestSummary;
  I18nContext = (await server.ssrLoadModule('/src/i18n/context.js')).I18nContext;
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

test('Trade latest-month summary does not turn an unpublished metric into zero or mix another month into the headline', () => {
  const html = renderToStaticMarkup(createElement(TradeLatestSummary, {
    row: { date: '2026-08', exports: 3100, imports: null, balance: null },
  }));
  assert.match(html, /Latest month: Aug 2026/);
  assert.match(html, /<dt>Imports<\/dt><dd>—<\/dd>/);
  assert.match(html, /<dt>Trade balance<\/dt><dd>—<\/dd>/);
  assert.doesNotMatch(html, /<dd>0/);
});
