import test from 'node:test';
import assert from 'node:assert/strict';

import { parseReserveObservations } from '../lib/reserves-parser.mjs';

test('reserves parser keeps a month whose values use a neighboring PDF baseline', () => {
  const items = [
    { page: 1, x: 6.651, y: 31.452, text: 'Jun 26 ' },
    { page: 1, x: 8.834, y: 31.114, text: 'P' },
    { page: 1, x: 16.036, y: 31.519, text: '18,376.2' },
    { page: 1, x: 23.334, y: 31.519, text: '4,857.4' },
    { page: 1, x: 28.676, y: 31.519, text: '23,233.6' },
  ];

  assert.deepEqual(parseReserveObservations(items), [
    { date: '2026-06', sbp: 18376.2, banks: 4857.4, total: 23233.6 },
  ]);
});
