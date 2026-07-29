import test from 'node:test';
import assert from 'node:assert/strict';
import {
  __resetDataCache,
  EMPTY_UI,
  getCachedData,
  getDataSnapshot,
  loadData,
  retryData,
  subscribeData,
} from '../../src/hooks/dataCache.js';

function mockFetchOnce(payload, { status = 200, fail = false } = {}) {
  const calls = [];
  globalThis.fetch = async (url, init) => {
    calls.push({ url: String(url), init });
    if (fail) throw new Error('network down');
    return {
      ok: status >= 200 && status < 300,
      status,
      async json() {
        return payload;
      },
    };
  };
  return calls;
}

test.afterEach(() => {
  __resetDataCache();
  delete globalThis.fetch;
});

test('loadData caches successful JSON and dedupes in-flight requests', async () => {
  const calls = mockFetchOnce({ hello: 'world' });
  const a = loadData('demo.json');
  const b = loadData('demo.json');
  const [ra, rb] = await Promise.all([a, b]);
  assert.equal(calls.length, 1);
  assert.deepEqual(ra.data, { hello: 'world' });
  assert.equal(rb.error, null);
  assert.deepEqual(getCachedData('demo.json').data, { hello: 'world' });

  await loadData('demo.json');
  assert.equal(calls.length, 1, 'second load should hit cache');
});

test('retryData force-refetches and notifies subscribers', async () => {
  mockFetchOnce({ n: 1 });
  await loadData('x.json');

  let notifies = 0;
  const unsub = subscribeData('x.json', () => {
    notifies += 1;
  });

  mockFetchOnce({ n: 2 });
  const result = await retryData('x.json');
  unsub();

  assert.deepEqual(result.data, { n: 2 });
  assert.ok(notifies >= 1);
});

test('failed loads surface error without inventing data', async () => {
  mockFetchOnce(null, { status: 500 });
  const result = await loadData('missing.json');
  assert.equal(result.data, null);
  assert.match(result.error.message, /Failed to load missing\.json: 500/);
});

test('getDataSnapshot returns a stable reference until the entry changes', async () => {
  assert.equal(getDataSnapshot('stable.json'), EMPTY_UI);
  mockFetchOnce({ ok: true });
  const pending = loadData('stable.json');
  const loadingSnap = getDataSnapshot('stable.json');
  assert.equal(loadingSnap.loading, true);
  assert.equal(getDataSnapshot('stable.json'), loadingSnap);

  await pending;
  const readySnap = getDataSnapshot('stable.json');
  assert.equal(readySnap.loading, false);
  assert.deepEqual(readySnap.data, { ok: true });
  assert.equal(getDataSnapshot('stable.json'), readySnap);
  assert.notEqual(readySnap, loadingSnap);
});
