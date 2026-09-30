import test from 'node:test';
import assert from 'node:assert/strict';
import { auditNativeValues, calculateEvidence, assertPublishedValue } from '../lib/native-evidence.mjs';

test('every published numeric field needs exact evidence, not a dataset receipt alone', async () => {
  await assert.rejects(auditNativeValues({ monthly: [{ date: '2026-08', value: 10 }], sourceEvidence: { artifactId: 'official' } }, async () => 10, 'sample'), /lacks exact evidence/);
  assert.equal(await auditNativeValues({ monthly: [{ date: '2026-08', value: 10, evidence: { artifactId: 'official', locator: {} } }] }, async () => 10, 'sample'), 1);
});

test('canonical figure corruption fails independently of archive integrity', async () => {
  await assert.rejects(auditNativeValues({ value: 11, evidence: { artifactId: 'official', locator: {} } }, async () => 10, 'sample'), /does not match/);
  assertPublishedValue(123.46, 123.456, 'rounded display');
  assert.throws(() => assertPublishedValue(123.47, 123.456, 'corrupt display'), /does not match/);
  assert.throws(() => assertPublishedValue(0, null, 'missing value must not become zero'), /does not match/);
});

test('derived figures are replayed using all inputs and unknown formulas fail closed', () => {
  assert.equal(calculateEvidence('sum', [1, 2, 3]), 6);
  assertPublishedValue(21.4003, calculateEvidence('US$ million divided by 1000', [21400.3]), 'conversion');
  assert.equal(calculateEvidence('SBP reserves / average of 12 consecutive monthly BOP goods imports', [100, ...Array(12).fill(25)]), 4);
  assert.throws(() => calculateEvidence('SBP reserves / average of 12 consecutive monthly BOP goods imports', [100, 25]), /12 positive/);
  assert.throws(() => calculateEvidence('invented formula', [1]), /Unknown calculation/);
});
