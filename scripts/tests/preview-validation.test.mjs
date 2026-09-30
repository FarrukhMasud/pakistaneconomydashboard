import test from 'node:test';
import assert from 'node:assert/strict';
import { previewHash, evaluateUpdatePreview } from '../lib/preview-validation.mjs';

const preview = { suspiciousDateJumps: [], sourceChanges: [], majorMovements: [] };

test('unsafe date/source changes block publication without real two-person review', () => {
  const current = { ...preview, sourceChanges: [{ dataset: 'trade' }] };
  assert.equal(evaluateUpdatePreview(current).approved, false);
  assert.equal(evaluateUpdatePreview(current, [{
    previewHash: previewHash(current), approvedAt: '2026-09-30T12:00:00Z', reason: 'Verified against the official source archive', reviewers: ['Reviewer', ' reviewer '],
  }]).approved, false);
});

test('review approvals are bound to the complete anomaly preview', () => {
  const current = { ...preview, majorMovements: [{ id: 'fdi', percent: 30 }] };
  const approvals = [{ previewHash: previewHash(current), approvedAt: '2026-09-30T12:00:00Z', reason: 'Verified against the official source archive', reviewers: ['one', 'two'] }];
  assert.equal(evaluateUpdatePreview(current, approvals).approved, true);
  assert.equal(evaluateUpdatePreview({ ...current, majorMovements: [{ id: 'fdi', percent: 40 }] }, approvals).approved, false);
});

test('routine updates do not require invented approval records', () => {
  assert.equal(evaluateUpdatePreview(preview).approved, true);
});

test('same-issuer homepage resolution is distinct from changing an official source', () => {
  const change = { dataset: 'fbr-tax', from: 'https://www.fbr.gov.pk', to: 'https://www.fbr.gov.pk/statistics/monthly.pdf' };
  assert.equal(evaluateUpdatePreview({ ...preview, sourceChanges: [change] }).approved, true);
  assert.equal(evaluateUpdatePreview({ ...preview, sourceChanges: [{ ...change, to: 'https://www.sbp.org.pk/monthly.pdf' }] }).approved, false);
  assert.equal(evaluateUpdatePreview({ ...preview, sourceChanges: [{ ...change, from: 'https://www.fbr.gov.pk/old.pdf' }] }).approved, false);
});
