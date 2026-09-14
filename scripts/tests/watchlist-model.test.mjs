import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { INDICATOR_CATALOG } from '../../src/utils/indicatorCatalog.js';
import { buildOverviewIndicators, KPI_ROUTES } from '../../src/utils/overviewModel.js';
import { normalizePins, resolveWatchlistItems } from '../../src/utils/watchlistModel.js';
import { createWatchlistStore, WATCHLIST_STORAGE_KEY } from '../../src/utils/watchlistStore.js';
import { routeToPath } from '../../src/hooks/useHashRoute.js';

const readData = (file) => JSON.parse(readFileSync(new URL(`../../public/data/${file}.json`, import.meta.url)));
const snapshot = readData('indicators');
const indicators = buildOverviewIndicators({
  summary: readData('kpi-summary'), trade: readData('trade'),
  remittances: readData('remittances'), snapshot,
});

function memoryStorage(initial = []) {
  let value = JSON.stringify(initial);
  return {
    getItem: (key) => key === WATCHLIST_STORAGE_KEY ? value : null,
    setItem: (key, next) => { assert.equal(key, WATCHLIST_STORAGE_KEY); value = next; },
  };
}

test('all KPI and catalog pins resolve labels and routes without raw ids or missing enriched values', () => {
  const pins = [...Object.keys(KPI_ROUTES), ...INDICATOR_CATALOG.map((row) => row.id)];
  const items = resolveWatchlistItems(pins, indicators);
  assert.ok(items.every((item) => item.kind !== 'unknown' && item.label && item.label !== item.id));
  assert.ok(items.every((item) => item.groupId && item.sectionId));
  for (const item of items.filter((row) => row.kind === 'kpi')) {
    assert.ok(item.value, `Missing ${item.id} value`);
    assert.ok(item.period, `Missing ${item.id} period`);
  }
  const debt = snapshot.indicators.find((row) => row.id === 'public-debt');
  assert.equal(items.find((row) => row.id === 'public-debt').value, `${debt.value} ${debt.unit}`);
  assert.equal(items.find((row) => row.id === 'ind-debt').sectionId, 'financing-wall');
  assert.equal(items.find((row) => row.id === 'circular-debt').sectionId, 'fiscal');
  assert.equal(items.find((row) => row.id === 'ind-country').value, null);
});

test('catalog aliases deduplicate with KPI ids but unrelated monetary and debt sections stay separate', () => {
  assert.deepEqual(normalizePins(['ind-cpi', 'inflation', null, 'ind-policy', 'policy-rate', 'ind-m2', 'ind-debt', 'public-debt']), [
    'inflation', 'policy-rate', 'ind-m2', 'ind-debt', 'public-debt',
  ]);
  const unknown = resolveWatchlistItems(['removed-internal-id'])[0];
  assert.equal(unknown.kind, 'unknown');
  assert.equal(unknown.label, undefined);
  assert.equal(unknown.sectionId, undefined);
});

test('catalog-only watchlist pins retain direct chart targets and policy pins open the policy tracker', () => {
  const pins = INDICATOR_CATALOG.filter((item) => item.chartId)
    .map((item) => item.id)
    .filter((id) => normalizePins([id])[0] === id);
  for (const item of resolveWatchlistItems(pins, indicators)) {
    const catalog = INDICATOR_CATALOG.find((row) => row.id === item.id);
    assert.equal(item.chartId, catalog.chartId);
    assert.equal(
      routeToPath(item.groupId, item.sectionId, { chartId: item.chartId }),
      `/${catalog.groupId}/${catalog.sectionId}?chart=${catalog.chartId}`,
    );
  }
  const policy = resolveWatchlistItems(['ind-policy'], indicators)[0];
  assert.equal(policy.id, 'policy-rate');
  assert.equal(policy.groupId, 'prices');
  assert.equal(policy.sectionId, 'monetary');
});

test('persisted aliases migrate in memory and toggles always read the latest store state', () => {
  const storage = memoryStorage(['ind-cpi', 'inflation']);
  const store = createWatchlistStore(() => storage);
  assert.deepEqual(store.getSnapshot().pins, ['inflation']);
  const toggle = store.toggle;
  toggle('reserves');
  toggle('ind-policy');
  assert.deepEqual(store.getSnapshot().pins, ['inflation', 'reserves', 'policy-rate']);
  toggle('ind-cpi');
  assert.deepEqual(JSON.parse(storage.getItem(WATCHLIST_STORAGE_KEY)), ['reserves', 'policy-rate']);
});

test('Undo reverses pin/unpin and clear, is idempotent and never overrides a newer unrelated action', () => {
  const memory = memoryStorage();
  const store = createWatchlistStore(() => memory);
  const initial = store.getSnapshot().pins;
  assert.deepEqual(initial, []);
  store.pin('inflation');
  const oldToken = store.getSnapshot().action.token;
  store.pin('reserves');
  store.undo(oldToken);
  assert.deepEqual(store.getSnapshot().pins, ['inflation', 'reserves']);
  const token = store.getSnapshot().action.token;
  store.undo(token);
  store.undo(token);
  assert.deepEqual(store.getSnapshot().pins, ['inflation']);
  store.unpin('ind-cpi');
  store.undo(store.getSnapshot().action.token);
  assert.deepEqual(store.getSnapshot().pins, ['inflation']);
  store.pin('trade');
  store.clear();
  store.undo(store.getSnapshot().action.token);
  assert.deepEqual(store.getSnapshot().pins, ['inflation', 'trade']);
});

test('a storage event invalidates old undo and retains the other tab watchlist', () => {
  const storage = memoryStorage();
  const store = createWatchlistStore(() => storage);
  store.pin('inflation');
  const token = store.getSnapshot().action.token;
  storage.setItem(WATCHLIST_STORAGE_KEY, JSON.stringify(['reserves', 'ind-cpi']));
  store.reload();
  store.undo(token);
  assert.deepEqual(store.getSnapshot().pins, ['reserves', 'inflation']);
});

test('dismissing feedback does not change pins or dismiss a newer notification', () => {
  const storage = memoryStorage();
  const store = createWatchlistStore(() => storage);
  store.pin('inflation');
  const token = store.getSnapshot().action.token;
  store.pin('trade');
  store.dismiss(token);
  assert.equal(store.getSnapshot().action.kind, 'pin');
  store.dismiss(store.getSnapshot().action.token);
  assert.equal(store.getSnapshot().action, null);
  assert.deepEqual(store.getSnapshot().pins, ['inflation', 'trade']);
});

test('storage failures remain visible while allowing explicitly session-only watchlist changes', (context) => {
  const warnings = [];
  context.mock.method(console, 'warn', (...args) => warnings.push(args));
  const store = createWatchlistStore(() => ({
    getItem: () => '{bad-json',
    setItem: () => { throw new Error('Quota exceeded'); },
  }));
  assert.equal(store.getSnapshot().error, 'read');
  store.pin('trade');
  assert.deepEqual(store.getSnapshot().pins, ['trade']);
  assert.equal(store.getSnapshot().error, 'write');
  assert.equal(warnings.length, 2);
});
