import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRoute, routeToPath } from '../../src/hooks/useHashRoute.js';

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
