import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute, routeFocusIdentity, routeToPath } from '../../src/hooks/useHashRoute.js';

const GROUPS = [
  {
    id: 'overview',
    sections: [{ id: 'overview' }],
  },
  {
    id: 'external',
    sections: [{ id: 'trade' }, { id: 'reserves' }],
  },
];

test('parseRoute accepts path and hash forms', () => {
  assert.deepEqual(
    parseRoute({ pathname: '/external/trade', hash: '' }, GROUPS),
    { groupId: 'external', sectionId: 'trade', known: true, assetLike: false },
  );
  assert.deepEqual(
    parseRoute({ pathname: '/', hash: '#/external/reserves' }, GROUPS),
    { groupId: 'external', sectionId: 'reserves', known: true, assetLike: false },
  );
});

test('parseRoute marks unknown paths without claiming they are known', () => {
  const unknown = parseRoute({ pathname: '/nope/missing', hash: '' }, GROUPS);
  assert.equal(unknown.known, false);
  assert.equal(unknown.groupId, 'overview');

  const asset = parseRoute({ pathname: '/data/trade.json', hash: '' }, GROUPS);
  assert.equal(asset.known, false);
  assert.equal(asset.assetLike, true);
});

test('parseRoute marks valid routes as known', () => {
  const route = parseRoute({ pathname: '/external/trade', hash: '' }, GROUPS);
  assert.equal(route.known, true);
  assert.deepEqual(
    { groupId: route.groupId, sectionId: route.sectionId },
    { groupId: 'external', sectionId: 'trade' },
  );
});

test('routeToPath builds canonical paths', () => {
  assert.equal(routeToPath('external', 'trade'), '/external/trade');
});

test('in-page anchors do not replace the current section route', () => {
  for (const hash of ['#main-content', '#chart-trade-balance']) {
    const route = parseRoute({ pathname: '/external/trade', hash }, GROUPS);
    assert.equal(route.known, true);
    assert.equal(route.sectionId, 'trade');
  }
});

test('legacy chart query links retain section semantics and unknown suffixes stay unknown', () => {
  const route = parseRoute({ pathname: '/', hash: '#/external/reserves?chart=chart-foreign-exchange-reserves' }, GROUPS);
  assert.equal(route.known, true);
  assert.equal(route.sectionId, 'reserves');
  assert.equal(parseRoute({ pathname: '/external/trade/unknown', hash: '' }, GROUPS).known, false);
  assert.equal(parseRoute({ pathname: '/', hash: '#/unknown/route' }, GROUPS).known, false);
});

test('chart controls in browser history do not masquerade as section focus navigation', () => {
  const location = { pathname: '/external/trade', hash: '', search: '?chart=chart-trade-balance&range=1y' };
  const identity = routeFocusIdentity(location, GROUPS);
  assert.equal(routeFocusIdentity({ ...location, search: '?chart=chart-trade-balance&range=all&compare=yoy&series=1' }, GROUPS), identity);
  assert.equal(routeFocusIdentity({ pathname: '/', hash: '#/external/trade?chart=chart-trade-balance' }, GROUPS), identity);
  assert.notEqual(routeFocusIdentity({ ...location, search: '?chart=chart-imports-vs-exports' }, GROUPS), identity);
  assert.notEqual(routeFocusIdentity({ ...location, pathname: '/external/reserves' }, GROUPS), identity);
});
