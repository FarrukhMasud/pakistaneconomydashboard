import { readFile, writeFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATASETS } from './data-catalog.mjs';
import { sha256 } from './lib/source-evidence.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const checks = ['audit-sanity.mjs', 'audit-publication.mjs', 'audit-evidence.mjs'];
const checkResults = [];
const checkedAt = new Date().toISOString();
const datasets = {};
let status = 'passed';
for (const check of checks) {
  const result = spawnSync(process.execPath, [resolve(root, 'scripts', check)], { cwd: root, stdio: 'inherit' });
  if (result.error) throw result.error;
  checkResults.push({ id: check, status: result.status === 0 ? 'passed' : 'failed' });
  if (result.status !== 0) status = 'failed';
}
for (const dataset of DATASETS) {
  const body = await readFile(resolve(root, 'public', 'data', dataset.file));
  const data = JSON.parse(body.toString('utf8'));
  datasets[dataset.id] = {
    status: data.publication?.status === 'withheld' ? 'pending' : status,
    checkedAt, contentHash: sha256(body), checks: checkResults,
  };
}
await writeFile(resolve(root, 'public', 'data', 'data-quality.json'), `${JSON.stringify({ schemaVersion: 1, status, checkedAt, datasets }, null, 2)}\n`);
if (status !== 'passed') process.exitCode = 1;
