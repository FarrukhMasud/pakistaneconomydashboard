import { spawnSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { collectReleaseFiles, releaseId, validateReleaseManifest } from './lib/release-integrity.mjs';
import { DATASETS } from './data-catalog.mjs';
import { sha256 } from './lib/source-evidence.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
try {
  const checks = [
    ['--test', ...(
      await Promise.all([resolve(root, 'scripts', 'tests'), resolve(root, 'src', 'utils', 'tests')].map(async directory =>
        (await readdir(directory)).filter(name => name.endsWith('.test.mjs')).sort().map(name => resolve(directory, name))))
    ).flat()],
    ...['audit-sanity.mjs', 'audit-publication.mjs', 'audit-evidence.mjs', 'audit-preview.mjs', 'audit-data.mjs'].map(name => [resolve(root, 'scripts', name)]),
  ];
  for (const args of checks) {
    const result = spawnSync(process.execPath, args, { cwd: root, stdio: 'inherit' });
    if (result.error) throw result.error;
    if (result.status !== 0) throw new Error(`Publication blocked by ${args[0]}`);
  }
  const quality = JSON.parse(await readFile(resolve(root, 'public', 'data', 'data-quality.json'), 'utf8'));
  if (quality.status !== 'passed') throw new Error('Calculation/source checks did not pass');
  for (const dataset of DATASETS) {
    const bytes = await readFile(resolve(root, 'public', 'data', dataset.file));
    if (quality.datasets[dataset.id]?.contentHash !== sha256(bytes)) throw new Error(`${dataset.id}: changed since its quality checks`);
  }
  const manifest = validateReleaseManifest(JSON.parse(await readFile(resolve(root, 'public', 'release-manifest.json'), 'utf8')));
  if (releaseId(await collectReleaseFiles(resolve(root, 'public'))) !== manifest.releaseId) throw new Error('Release content has changed after validation');
  console.log(`Publication checks passed for release ${manifest.releaseId.slice(0, 12)}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
