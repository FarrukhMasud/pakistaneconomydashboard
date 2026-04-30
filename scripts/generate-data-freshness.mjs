#!/usr/bin/env node

import { readFile, writeFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { DATASETS, getDatasetFreshness } from './data-catalog.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '..', 'public', 'data');

async function readJson(file) {
  return JSON.parse(await readFile(resolve(DATA_DIR, file), 'utf-8'));
}

async function writeJson(file, data) {
  await writeFile(resolve(DATA_DIR, file), JSON.stringify(data, null, 2) + '\n');
}

async function main() {
  const generatedAt = new Date().toISOString();
  const datasets = [];

  for (const dataset of DATASETS) {
    try {
      const data = await readJson(dataset.file);
      datasets.push(getDatasetFreshness(dataset, data));
    } catch (err) {
      datasets.push({
        id: dataset.id,
        label: dataset.label,
        file: dataset.file,
        source: dataset.source,
        sourceUrl: dataset.sourceUrl,
        parser: dataset.parser,
        cadence: dataset.cadence,
        critical: dataset.critical,
        latestObservation: null,
        dashboardUpdated: null,
        status: 'missing',
        error: err.message,
      });
    }
  }

  await writeJson('source-manifest.json', {
    generatedAt,
    sources: DATASETS.map(({ latest, ...dataset }) => dataset),
  });

  await writeJson('data-freshness.json', {
    generatedAt,
    status: datasets.some(d => d.status !== 'fresh') ? 'needs-review' : 'fresh',
    datasets,
  });

  console.log(`✅ Generated source-manifest.json and data-freshness.json for ${datasets.length} datasets`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
