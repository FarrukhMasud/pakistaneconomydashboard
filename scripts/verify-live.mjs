#!/usr/bin/env node

import { readFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { DATASETS, LIVE_URL, getDatasetFreshness } from './data-catalog.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '..', 'public', 'data');

async function readLocal(file) {
  return JSON.parse(await readFile(resolve(DATA_DIR, file), 'utf-8'));
}

async function readLive(file) {
  const url = `${LIVE_URL}/data/${file}?verify=${Date.now()}`;
  const res = await fetch(url, { cache: 'no-store' });
  if (!res.ok) throw new Error(`${file}: live HTTP ${res.status}`);
  return res.json();
}

async function main() {
  let mismatches = 0;
  console.log('\nVerifying live Azure data against local files\n');

  for (const dataset of DATASETS) {
    const [localData, liveData] = await Promise.all([
      readLocal(dataset.file),
      readLive(dataset.file),
    ]);
    const local = getDatasetFreshness(dataset, localData);
    const live = getDatasetFreshness(dataset, liveData);
    const same = local.latestObservation === live.latestObservation && local.dashboardUpdated === live.dashboardUpdated;
    if (!same) mismatches++;
    console.log(`${same ? '✅' : '❌'} ${dataset.label}: local ${local.latestObservation}/${local.dashboardUpdated} | live ${live.latestObservation}/${live.dashboardUpdated}`);
  }

  if (mismatches > 0) {
    console.error(`\n❌ ${mismatches} live dataset(s) do not match local output.`);
    process.exit(1);
  }

  console.log('\n✅ Live Azure data matches local generated data.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
