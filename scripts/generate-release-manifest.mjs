import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectReleaseFiles, releaseId } from './lib/release-integrity.mjs';

const publicDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public');

try {
  const quality = JSON.parse(await readFile(resolve(publicDir, 'data', 'data-quality.json'), 'utf8'));
  if (quality.status !== 'passed') throw new Error('A checked quality report is required before creating a release');
  const files = await collectReleaseFiles(publicDir);
  const manifest = {
    schemaVersion: 1, releaseId: releaseId(files), generatedAt: new Date().toISOString(),
    qualityCheckedAt: quality.checkedAt, files,
  };
  await writeFile(resolve(publicDir, 'release-manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`);
  console.log(`Release ${manifest.releaseId.slice(0, 12)} contains ${files.length} content-verified assets`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
