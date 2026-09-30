import test from 'node:test';
import assert from 'node:assert/strict';
import { resetProvenance, recordProvenance, currentProvenance, retainPublishedProvenance } from '../lib/provenance-store.mjs';

const entry = {
  label: 'Test official figure', sourceKey: 'forex.pdf', value: 1, unit: 'USD million', period: '2026-08-28',
  evidence: { artifactId: 'test-receipt', retrievedAt: '2026-08-29T10:00:00Z' },
  locator: { page: 1, row: 'SBP reserves' },
};

test('retrieval dates and publication statuses are not fabricated during citation generation', async () => {
  resetProvenance();
  await recordProvenance('test', entry);
  const figure = currentProvenance().test;
  assert.equal(figure.retrievedAt, entry.evidence.retrievedAt);
  assert.equal(figure.status, 'not-stated');
  assert.deepEqual(figure.locator, entry.locator);
});

test('missing numbers and unknown finality statuses cannot be cited as facts', async () => {
  resetProvenance();
  await assert.rejects(recordProvenance('test', { ...entry, value: null }), /missing or invalid/);
  await assert.rejects(recordProvenance('test', { ...entry, value: NaN }), /missing or invalid/);
  await assert.rejects(recordProvenance('test', { ...entry, status: 'probably-final' }), /unknown publication/);
});

test('withheld KPI citations are removed rather than remaining discoverable', async () => {
  resetProvenance();
  await recordProvenance('kept', entry);
  await recordProvenance('withheld', entry);
  await retainPublishedProvenance(['kept']);
  assert.deepEqual(Object.keys(currentProvenance()), ['kept']);
});
