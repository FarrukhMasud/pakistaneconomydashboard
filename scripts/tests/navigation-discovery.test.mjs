import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { createServer } from 'vite';
import { INDICATOR_CATALOG, normalizeSearch, scoreSearch, searchIndicators } from '../../src/utils/indicatorCatalog.js';
import { SECTION_DESCRIPTIONS, isPlainNavigation, trackDiscovery } from '../../src/utils/sectionCatalog.js';
import { readChartTarget, routeToPath } from '../../src/hooks/useHashRoute.js';
import { lockNavigationScroll, paletteShortcutAction } from '../../src/utils/navigationModal.js';

test('Urdu and familiar English terms find the relevant indicator first', () => {
  for (const [query, id] of [
    ['مہنگائی', 'ind-cpi'], ['مَہنگائی', 'ind-cpi'], ['افراط زر', 'ind-cpi'],
    ['ڈالر', 'ind-exchange'], ['dollar rate', 'ind-exchange'],
    ['شرح سود', 'ind-policy'], ['ترسیلات زر', 'ind-remit'],
    ['ٹیکس وصولی', 'ind-fbr'], ['food inflation', 'ind-food'],
    ['زرمبادلہ کے ذخائر', 'ind-reserves'], ['گردشی قرضہ', 'ind-circular'],
    ['نجی شعبے کے قرضے', 'ind-credit'], ['بجٹ خسارہ', 'ind-deficit'],
    ['IT exports', 'ind-it'], ['ایف بی آر', 'ind-fbr'],
  ]) {
    assert.equal(searchIndicators(query)[0]?.id, id, query);
  }
});

test('search normalizes Urdu keyboard variants and ignores empty punctuation', () => {
  assert.equal(normalizeSearch('  نجى شعبے كے قرضے  '), normalizeSearch('نجی شعبے کے قرضے'));
  assert.equal(normalizeSearch('مَہنگائی'), normalizeSearch('مہنگائی'));
  assert.equal(normalizeSearch('افراط\u200c زر'), 'افراط زر');
  assert.equal(scoreSearch(['مہنگائی'], 'قیمتوںمیںبےترتیبی'), 0);
  assert.equal(scoreSearch(['foreign reserves'], 'reserves foreign'), 2);
  assert.equal(searchIndicators('').length, INDICATOR_CATALOG.length);
  assert.equal(searchIndicators('a-phrase-that-does-not-match-any-indicator').length, 0);
});

test('chart targets round-trip without changing English IDs or unrelated query state', () => {
  const entry = INDICATOR_CATALOG.find((item) => item.id === 'ind-cpi');
  const href = routeToPath(entry.groupId, entry.sectionId, { chartId: entry.chartId, search: '?embed=1&compare=yoy' });
  const url = new URL(href, 'https://example.com');
  assert.equal(url.pathname, '/prices/inflation');
  assert.equal(url.searchParams.get('embed'), '1');
  assert.equal(url.searchParams.get('compare'), 'yoy');
  assert.equal(readChartTarget(url), 'chart-national-cpi-year-over-year');
  assert.equal(readChartTarget({ pathname: '/', hash: '#/prices/inflation?chart=chart-food-vs-non-food-inflation' }), 'chart-food-vs-non-food-inflation');
  assert.equal(readChartTarget({ search: '?chart=%23unsafe%5Bselector%5D' }), null);
  assert.equal(routeToPath('prices', 'inflation', { search: '?chart=old&embed=1' }), '/prices/inflation?embed=1');
  assert.equal(searchIndicators('SPI')[0].chartId, 'chart-cpi-vs-spi-vs-wpi');
  assert.equal(searchIndicators('WPI')[0].chartId, 'chart-cpi-vs-spi-vs-wpi');
  assert.equal(searchIndicators('برآمدات')[0].chartId, 'chart-imports-vs-exports');
  assert.equal(searchIndicators('import cover')[0].chartId, 'chart-goods-import-cover-history');
  assert.equal(searchIndicators('China')[0].chartId, null);
});

test('policy, circular debt, repayment and import-cover queries reach their mounted trackers', () => {
  for (const [query, expected] of [
    ['policy rate', '/prices/monetary?chart=chart-policy-rate-history'],
    ['شرح سود', '/prices/monetary?chart=chart-policy-rate-history'],
    ['circular debt', '/fiscal/fiscal?chart=chart-power-circular-debt-stock'],
    ['گردشی قرضہ', '/fiscal/fiscal?chart=chart-power-circular-debt-stock'],
    ['repayment', '/fiscal/fiscal?chart=chart-external-debt-repayment-split'],
    ['قرضوں کی ادائیگی', '/fiscal/fiscal?chart=chart-external-debt-repayment-split'],
    ['import cover', '/external/reserves?chart=chart-goods-import-cover-history'],
    ['درآمدی ضروریات', '/external/reserves?chart=chart-goods-import-cover-history'],
    ['external debt', '/insights/financing-wall'],
    ['financing wall', '/insights/financing-wall'],
  ]) {
    const item = searchIndicators(query)[0];
    assert.equal(routeToPath(item.groupId, item.sectionId, { chartId: item.chartId }), expected, query);
  }
  assert.equal(searchIndicators('repayment')[0].labelKey, 'chart.debtRepaymentSplit');
});

test('every chart result is backed by an existing ChartCard title', () => {
  const componentDir = fileURLToPath(new URL('../../src/components/', import.meta.url));
  const files = {
    reserves: 'ReservesSection.jsx', exchange: 'ExchangeRateSection.jsx', trade: 'TradeSection.jsx',
    'country-trends': 'CountryTrendsSection.jsx', remittances: 'RemittancesSection.jsx',
    fdi: 'FdiSection.jsx', services: 'ServicesSection.jsx', inflation: 'InflationSection.jsx',
    monetary: 'MonetarySection.jsx', fiscal: 'FiscalSection.jsx', fbr: 'FbrTaxSection.jsx',
    'federal-budget': 'FederalBudgetSection.jsx', 'provincial-budget': 'ProvincialBudgetSection.jsx',
  };
  const trackerFiles = {
    'chart-policy-rate-history': 'MonetaryPolicyTracker',
    'chart-power-circular-debt-stock': 'CircularDebtTracker',
    'chart-external-debt-repayment-split': 'ExternalDebtTracker',
    'chart-goods-import-cover-history': 'ReservesAdequacyTracker',
  };
  const entries = [...INDICATOR_CATALOG, searchIndicators('repayment')[0], searchIndicators('import cover')[0]];
  for (const entry of entries.filter((item) => item.chartId)) {
    const source = fs.readFileSync(path.join(componentDir, files[entry.sectionId]), 'utf8');
    const tracker = trackerFiles[entry.chartId];
    if (tracker) {
      assert.ok(source.includes(`<${tracker}`), `${tracker} is mounted by ${entry.sectionId}`);
      const trackerSource = fs.readFileSync(path.join(componentDir, `${tracker}.jsx`), 'utf8');
      assert.ok(trackerSource.includes(`chartId="${entry.chartId}"`), `${tracker} declares ${entry.chartId}`);
      continue;
    }
    const titles = [...source.matchAll(/<ChartCard\b[\s\S]*?title="([^"]+)"/g)].map((match) => match[1]);
    assert.ok(titles.includes(entry.chartTitle), `${entry.id}: ${entry.chartTitle}`);
  }
});

test('rendered charts expose stable, focusable, labelled anchors with explicit and fallback ID support', async () => {
  const server = await createServer({
    server: { middlewareMode: true, hmr: false },
    optimizeDeps: { noDiscovery: true, include: [] },
    appType: 'custom',
    logLevel: 'error',
  });
  try {
    const ChartCard = (await server.ssrLoadModule('/src/components/ChartCard.jsx')).default;
    const { I18nContext } = await server.ssrLoadModule('/src/i18n/context.js');
    const regions = (html) => [...html.matchAll(/<[^>]+\bclass="([^"]*)"[^>]*>/g)]
      .filter((match) => match[1].split(/\s+/).includes('chart-card'))
      .map((match) => match[0]);
    const regionId = (region) => region.match(/\bid="([^"]+)"/)?.[1]
      || region.match(/\baria-labelledby="([^"]+)"/)?.[1];
    const assertAnchor = (html, expectedId) => {
      const [region] = regions(html);
      assert.ok(region, 'Rendered chart region exists');
      assert.equal(regionId(region), expectedId);
      assert.match(region, /\brole="region"/);
      const headingId = region.match(/\baria-labelledby="([^"]+)"/)?.[1];
      assert.ok(headingId, 'Chart has an accessible heading reference');
      const headings = [...html.matchAll(/<h[1-6]\b[^>]*>/g)].map((match) => match[0]);
      assert.ok(headings.some((heading) => heading.includes(`id="${headingId}"`)), 'Referenced chart heading exists');
      const target = [region, ...headings].find((element) => element.includes(`id="${expectedId}"`));
      assert.match(target, /\btabindex="-1"/, 'The direct-link target is keyboard focusable');
    };
    for (const item of INDICATOR_CATALOG.filter((entry) => entry.chartId)) {
      assertAnchor(renderToStaticMarkup(createElement(ChartCard, { title: item.chartTitle })), item.chartId);
    }
    assertAnchor(renderToStaticMarkup(createElement(ChartCard, {
      title: 'A title that can change', chartId: 'chart-explicit-target',
    })), 'chart-explicit-target');
    for (const query of ['policy rate', 'circular debt', 'repayment', 'import cover']) {
      const item = searchIndicators(query)[0];
      assertAnchor(renderToStaticMarkup(createElement(ChartCard, {
        title: 'اردو عنوان', chartId: item.chartId,
      })), item.chartId);
    }

    const localized = renderToStaticMarkup(createElement(I18nContext.Provider, {
      value: {
        t: (key, fallback) => fallback || key,
        tx: (text) => text === 'Trade Balance' ? 'تجارتی توازن' : text,
      },
    }, createElement(ChartCard, { title: 'Trade Balance' })));
    assertAnchor(localized, 'chart-trade-balance');
    assert.ok(localized.includes('تجارتی توازن'));

    const fallbackHtml = renderToStaticMarkup(createElement('div', null,
      createElement(ChartCard, { title: 'قیمتیں' }),
      createElement(ChartCard, { title: 'قیمتیں' })));
    const fallbackIds = regions(fallbackHtml).map(regionId);
    assert.equal(fallbackIds.length, 2);
    assert.equal(new Set(fallbackIds).size, 2, 'Non-sluggable titles receive distinct fallback IDs');
    for (const id of fallbackIds) assert.match(id, /^chart-[a-z0-9-]+$/);
  } finally {
    await server.close();
  }
});

test('browser descriptions cover every registered section, not a hardcoded section count', () => {
  const source = fs.readFileSync(new URL('../../src/App.jsx', import.meta.url), 'utf8');
  const sectionIds = [...source.matchAll(/\{ id: '([^']+)', label: '[^']+', component:/g)].map((match) => match[1]);
  assert.equal(sectionIds.length, Object.keys(SECTION_DESCRIPTIONS).length);
  for (const id of sectionIds) assert.ok(SECTION_DESCRIPTIONS[id]?.length > 25, id);
  for (const item of INDICATOR_CATALOG) assert.ok(sectionIds.includes(item.sectionId), item.id);
});

test('native links keep modified clicks and analytics never send queries or pins', () => {
  assert.equal(isPlainNavigation({ button: 0 }), true);
  for (const modifier of ['ctrlKey', 'metaKey', 'shiftKey', 'altKey', 'defaultPrevented']) {
    assert.equal(isPlainNavigation({ button: 0, [modifier]: true }), false, modifier);
  }
  assert.equal(isPlainNavigation({ button: 1 }), false);
  const calls = [];
  const priorWindow = globalThis.window;
  globalThis.window = {
    location: { origin: 'https://example.com', pathname: '/prices/inflation', search: '?private-text=secret' },
    plausible: (...args) => calls.push(args),
  };
  try {
    trackDiscovery('indicator');
    trackDiscovery('browse');
    trackDiscovery('csv');
    trackDiscovery('raw query that must not be collected');
    assert.deepEqual(calls, [
      ['Indicator search selection', { u: 'https://example.com/' }],
      ['Browse section navigation', { u: 'https://example.com/' }],
      ['Chart CSV download', { u: 'https://example.com/' }],
    ]);
  } finally {
    if (priorWindow === undefined) delete globalThis.window;
    else globalThis.window = priorWindow;
  }
});

test('palette shortcuts cannot stack over another dialog or interrupt typing', () => {
  const command = { key: 'k', ctrlKey: true };
  assert.equal(paletteShortcutAction(command), 'open');
  assert.equal(paletteShortcutAction(command, { open: true }), 'close');
  for (const open of [false, true]) {
    assert.equal(paletteShortcutAction(command, { open, anotherDialogOpen: true }), null);
    assert.equal(paletteShortcutAction({ key: '/' }, { open, anotherDialogOpen: true }), null);
  }
  for (const property of ['repeat', 'defaultPrevented', 'isComposing']) {
    assert.equal(paletteShortcutAction({ ...command, [property]: true }), null);
  }
  assert.equal(paletteShortcutAction({ key: '/' }), 'open');
  assert.equal(paletteShortcutAction({ key: '/', target: { tagName: 'INPUT' } }), null);
  assert.equal(paletteShortcutAction({ key: '/', target: { isContentEditable: true } }), null);
  assert.equal(paletteShortcutAction({ key: '/', ctrlKey: true }), null);
});

test('navigation scroll locks restore the original style after all dialogs close in either order', () => {
  for (const order of [[0, 1], [1, 0]]) {
    const body = { style: { overflow: 'auto' } };
    const releases = [lockNavigationScroll(body), lockNavigationScroll(body)];
    releases[order[0]]();
    assert.equal(body.style.overflow, 'hidden');
    releases[order[0]]();
    assert.equal(body.style.overflow, 'hidden');
    releases[order[1]]();
    assert.equal(body.style.overflow, 'auto');
    const next = lockNavigationScroll(body);
    next();
    assert.equal(body.style.overflow, 'auto');
  }
});

test('navigation CSS only uses defined theme variables and dialogs have instance-specific labels', () => {
  const theme = fs.readFileSync(new URL('../../src/index.css', import.meta.url), 'utf8');
  const css = fs.readFileSync(new URL('../../src/styles/navigation.css', import.meta.url), 'utf8');
  const definitions = new Set([...theme.matchAll(/(--[\w-]+)\s*:/g)].map((match) => match[1]));
  for (const [, name] of css.matchAll(/var\((--[\w-]+)/g)) assert.ok(definitions.has(name), name);
  const dialog = fs.readFileSync(new URL('../../src/components/NavigationDialog.jsx', import.meta.url), 'utf8');
  assert.match(dialog, /const id = useId\(\)/);
  assert.doesNotMatch(dialog, /id="navigation-dialog-(title|description)"/);
});
