import test from 'node:test';
import assert from 'node:assert/strict';

import { getDatasetFreshness } from '../data-catalog.mjs';

test('verification dates never replace the economic observation date', () => {
  const result = getDatasetFreshness(
    {
      id: 'test',
      label: 'Test dataset',
      cadence: 'event-driven',
      sourceType: 'official',
      latest: (data) => data.observationDate,
    },
    {
      observationDate: '2026-05-08',
      publicationDate: '2026-05-08',
      lastVerified: '2026-08-07',
      lastUpdated: '2026-05-08',
    },
  );

  assert.equal(result.latestObservation, '2026-05-08');
  assert.equal(result.observationDate, '2026-05-08');
  assert.equal(result.publicationDate, '2026-05-08');
  assert.equal(result.verificationDate, '2026-08-07');
  assert.equal(result.dashboardUpdated, '2026-05-08');
});
