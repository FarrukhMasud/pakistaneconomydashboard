import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { resolve } from 'node:path';
import { captureSourceArtifact, getSourceEvidence, getSourceEvidenceById, quarantineIncompleteArtifacts, auditSourceArtifacts, recordSourceFailure, validateOfficialUrl } from '../lib/source-evidence.mjs';

async function fixture(t) {
  const rootDir = await mkdtemp(resolve(tmpdir(), 'pak-eco-evidence-test-'));
  t.after(() => rm(rootDir, { recursive: true, force: true }));
  await mkdir(resolve(rootDir, 'scripts'));
  await writeFile(resolve(rootDir, 'scripts', 'test-parser.mjs'), 'export const parser = true;\n');
  return rootDir;
}

const input = {
  sourceKey: 'example', sourceUrl: 'https://www.sbp.org.pk/economic-data',
  body: '{"observations":[1]}', contentType: 'application/json',
  filename: 'example.json', parser: 'test-parser.mjs',
};

test('only approved official HTTPS origins without credentials are accepted', () => {
  assert.throws(() => validateOfficialUrl('https://sbp.org.pk.example.com'), /official/);
  assert.throws(() => validateOfficialUrl('http://www.sbp.org.pk'), /official/);
  assert.throws(() => validateOfficialUrl('https://www.sbp.org.pk?api_key=redacted'), /credentials/);
  assert.throws(() => validateOfficialUrl('https://user:password@www.sbp.org.pk'), /official/);
  assert.equal(validateOfficialUrl('https://easydata.sbp.org.pk'), 'https://easydata.sbp.org.pk/');
});

test('identical official bytes preserve the original retrieval receipt and advance source checks', async t => {
  const rootDir = await fixture(t);
  const first = await captureSourceArtifact(input, { rootDir });
  const second = await captureSourceArtifact(input, { rootDir });
  assert.deepEqual(first, second);
  const catalog = await auditSourceArtifacts({ rootDir });
  assert.equal(catalog.artifacts.length, 1);
  assert.ok(catalog.checks.example.checkedAt >= first.retrievedAt);
});

test('corrupt archived source data fails closed', async t => {
  const rootDir = await fixture(t);
  const receipt = await captureSourceArtifact(input, { rootDir });
  await writeFile(resolve(rootDir, 'public', ...receipt.path.slice(1).split('/')), 'modified');
  await assert.rejects(getSourceEvidence('example', { rootDir }), /integrity/);
  await assert.rejects(auditSourceArtifacts({ rootDir }), /Corrupt/);
});

test('concurrent capture operations retain every artifact and failure receipt', async t => {
  const rootDir = await fixture(t);
  await Promise.all([
    captureSourceArtifact({ ...input, sourceKey: 'a', body: 'a' }, { rootDir }),
    captureSourceArtifact({ ...input, sourceKey: 'b', body: 'b' }, { rootDir }),
    recordSourceFailure('c', 'HTTP 503', { rootDir }),
  ]);
  const catalog = JSON.parse(await readFile(resolve(rootDir, 'public', 'data', 'source-artifacts.json'), 'utf8'));
  assert.equal(catalog.artifacts.length, 2);
  assert.equal(catalog.checks.c.status, 'failed');
});

test('redirects to another official institution are rejected', async t => {
  const rootDir = await fixture(t);
  await assert.rejects(captureSourceArtifact({ ...input, responseUrl: 'https://www.imf.org/example' }, { rootDir }), /different institution/);
});

test('parser dependency changes are archived and bind a new evidence receipt', async t => {
  const rootDir = await fixture(t);
  await mkdir(resolve(rootDir, 'scripts', 'lib'));
  await writeFile(resolve(rootDir, 'scripts', 'test-parser.mjs'), "import { version } from './lib/helper.mjs';\nexport { version };\n");
  await writeFile(resolve(rootDir, 'scripts', 'lib', 'helper.mjs'), 'export const version = 1;\n');
  const before = await captureSourceArtifact(input, { rootDir });
  await writeFile(resolve(rootDir, 'scripts', 'lib', 'helper.mjs'), 'export const version = 2;\n');
  const after = await captureSourceArtifact(input, { rootDir });
  assert.notEqual(before.parserVersion, after.parserVersion);
  assert.notEqual(before.artifactId, after.artifactId);
  assert.equal(before.sha256, after.sha256);
  const catalog = await auditSourceArtifacts({ rootDir });
  assert.equal(catalog.artifacts.length, 2);
});

test('source-check failures redact credential parameters', async t => {
  const rootDir = await fixture(t);
  await recordSourceFailure('example', 'HTTP failure https://easydata.sbp.org.pk?api_key=never-publish-this&x=1', { rootDir });
  const catalog = await auditSourceArtifacts({ rootDir });
  assert.ok(!catalog.checks.example.reason.includes('never-publish-this'));
});

test('incomplete historical receipts retain original bytes and metadata but cannot certify figures', async t => {
  const rootDir = await fixture(t);
  const original = await captureSourceArtifact(input, { rootDir });
  const filename = resolve(rootDir, 'public', 'data', 'source-artifacts.json');
  const catalog = JSON.parse(await readFile(filename, 'utf8'));
  const legacy = { ...original, artifactId: 'legacy-receipt', parserVersion: 'test-parser.mjs:legacy' };
  delete legacy.parserPath;
  delete legacy.parserDependencies;
  catalog.artifacts = [legacy];
  catalog.sources.example = legacy.artifactId;
  await writeFile(filename, JSON.stringify(catalog));
  assert.deepEqual(await quarantineIncompleteArtifacts({ rootDir }), [legacy.artifactId]);
  const migrated = await auditSourceArtifacts({ rootDir });
  assert.deepEqual(migrated.quarantinedArtifacts[0].receipt, legacy);
  assert.equal(migrated.checks.example.status, 'needs-review');
  assert.equal(await getSourceEvidenceById(legacy.artifactId, { rootDir }), null);
  assert.equal(await readFile(resolve(rootDir, 'public', 'source-evidence', `${original.sha256}.json`), 'utf8'), input.body);
  assert.deepEqual(await quarantineIncompleteArtifacts({ rootDir }), []);
  const fresh = await captureSourceArtifact(input, { rootDir });
  assert.equal((await getSourceEvidenceById(fresh.artifactId, { rootDir })).artifactId, fresh.artifactId);
  assert.equal((await auditSourceArtifacts({ rootDir })).quarantinedArtifacts[0].receipt.retrievedAt, legacy.retrievedAt);
});
