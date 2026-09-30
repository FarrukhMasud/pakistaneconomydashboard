import test from 'node:test';
import assert from 'node:assert/strict';
import { contentEntry, releaseId, validateReleaseManifest, verifyLiveRelease } from '../lib/release-integrity.mjs';

test('same dates do not conceal changed production content', () => {
  const before = [contentEntry('/data/example.json', '{"date":"2026-08","value":1}')];
  const after = [contentEntry('/data/example.json', '{"date":"2026-08","value":2}')];
  assert.notEqual(releaseId(before), releaseId(after));
});

test('live verification checks every dataset, CSV, evidence and feed byte, not only the manifest', async () => {
  const bodies = new Map([
    ['/data/a.json', Buffer.from('{"date":"2026-08","value":1}')],
    ['/api/v1/a.csv', Buffer.from('date,value\n2026-08,1\n')],
    ['/source-evidence/a.txt', Buffer.from('official source')],
    ['/feed.xml', Buffer.from('<feed/>')],
  ]);
  const files = [...bodies].map(([path, body]) => contentEntry(path, body));
  const manifest = { schemaVersion: 1, files, releaseId: releaseId(files) };
  bodies.set('/release-manifest.json', Buffer.from(JSON.stringify(manifest)));
  const calls = new Set();
  await verifyLiveRelease(manifest, path => {
    calls.add(path);
    return Promise.resolve(bodies.get(path));
  });
  assert.equal(calls.size, files.length + 1);
  bodies.set('/api/v1/a.csv', Buffer.from('date,value\n2026-08,2\n'));
  await assert.rejects(verifyLiveRelease(manifest, path => Promise.resolve(bodies.get(path))), /content differs/);
});

test('missing files and an old live release fail verification', async () => {
  const files = [contentEntry('/data/a.json', 'a')];
  const manifest = { schemaVersion: 1, files, releaseId: releaseId(files) };
  await assert.rejects(verifyLiveRelease(manifest, async path => {
    if (path === '/release-manifest.json') return Buffer.from(JSON.stringify(manifest));
    throw new Error('HTTP 404');
  }), /HTTP 404/);
  const oldFiles = [contentEntry('/data/a.json', 'old')];
  await assert.rejects(verifyLiveRelease(manifest, async () => Buffer.from(JSON.stringify({
    schemaVersion: 1, files: oldFiles, releaseId: releaseId(oldFiles),
  }))), /Different release/);
});

test('release identity is stable across file ordering', () => {
  const entries = [contentEntry('/data/a.json', 'a'), contentEntry('/api/v1/b.csv', 'b')];
  assert.equal(releaseId(entries), releaseId([...entries].reverse()));
  const manifest = { schemaVersion: 1, releaseId: releaseId(entries), files: entries };
  assert.equal(validateReleaseManifest(manifest), manifest);
});

test('duplicate, unsafe, or forged manifest entries are rejected', () => {
  const entry = contentEntry('/data/a.json', 'a');
  for (const files of [[entry, entry], [{ ...entry, path: '/data/../secret' }], [{ ...entry, sha256: 'fake' }]]) {
    assert.throws(() => validateReleaseManifest({ schemaVersion: 1, releaseId: releaseId(files), files }));
  }
});
