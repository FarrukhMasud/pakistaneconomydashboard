import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { withUpdateLock } from '../lib/update-lock.mjs';

test('parallel full refreshes cannot overwrite each other and release their lock', async t => {
  const rootDir = await mkdtemp(resolve(tmpdir(), 'pak-eco-lock-test-'));
  t.after(() => rm(rootDir, { recursive: true, force: true }));
  const result = await withUpdateLock(async () => {
    await assert.rejects(withUpdateLock(() => {}, rootDir), /Another data refresh/);
    return 'complete';
  }, rootDir);
  assert.equal(result, 'complete');
  await assert.rejects(access(resolve(rootDir, '.data-update.lock')));
});

test('a failed refresh releases its own lock without pretending success', async t => {
  const rootDir = await mkdtemp(resolve(tmpdir(), 'pak-eco-lock-test-'));
  t.after(() => rm(rootDir, { recursive: true, force: true }));
  await assert.rejects(withUpdateLock(() => { throw new Error('source failed'); }, rootDir), /source failed/);
  await assert.rejects(access(resolve(rootDir, '.data-update.lock')));
});
