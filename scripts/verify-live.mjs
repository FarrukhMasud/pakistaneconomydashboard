#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { LIVE_URL } from './data-catalog.mjs';
import { collectReleaseFiles, releaseId, validateReleaseManifest, verifyLiveRelease } from './lib/release-integrity.mjs';

const publicDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public');

async function main() {
  const args = process.argv.slice(2);
  const urlIndex = args.indexOf('--url');
  const origin = new URL(urlIndex >= 0 ? args[urlIndex + 1] : LIVE_URL);
  if (!['http:', 'https:'].includes(origin.protocol) || origin.username || origin.password) throw new Error('Invalid verification origin');
  const local = validateReleaseManifest(JSON.parse(await readFile(resolve(publicDir, 'release-manifest.json'), 'utf8')));
  const actualLocal = await collectReleaseFiles(publicDir);
  if (releaseId(actualLocal) !== local.releaseId) throw new Error('Local files changed after the checked release manifest was created');
  const readLive = async (path) => {
    const url = new URL(path, origin);
    url.searchParams.set('verify', `${local.releaseId}-${Date.now()}`);
    const response = await fetch(url, { cache: 'no-store', signal: AbortSignal.timeout(30000) });
    if (!response.ok) throw new Error(`${path}: live HTTP ${response.status}`);
    return Buffer.from(await response.arrayBuffer());
  };
  await verifyLiveRelease(local, readLive);
  console.log(`Verified all ${local.files.length} dataset, API, evidence, and feed assets for release ${local.releaseId.slice(0, 12)}`);
}

main().catch(error => {
  console.error(error.message);
  process.exitCode = 1;
});
