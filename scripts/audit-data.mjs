#!/usr/bin/env node

import { readFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { DATASETS, getDatasetFreshness } from './data-catalog.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '..', 'public', 'data');

async function readJson(file) {
  return JSON.parse(await readFile(resolve(DATA_DIR, file), 'utf-8'));
}

function pad(value, width) {
  return String(value ?? '').slice(0, width).padEnd(width);
}

async function main() {
  const rows = [];
  const catalog = await readJson('source-artifacts.json');

  for (const dataset of DATASETS) {
    const data = await readJson(dataset.file);
    const freshness = getDatasetFreshness(dataset, data, { checks: catalog.checks || {} });
    rows.push(freshness);
  }

  console.log('\nPakistan Economic Dashboard — Data Freshness Audit\n');
  console.log(`${pad('Dataset', 27)} ${pad('Observed', 14)} ${pad('Published', 12)} ${pad('Verified', 12)} Status`);
  console.log('-'.repeat(84));

  let failures = 0;
  for (const row of rows) {
    const ok = row.status === 'fresh' || row.status === 'withheld';
    if (!ok && row.critical) failures++;
    console.log(`${pad(row.label, 27)} ${pad(row.observationDate || row.latestObservation || 'N/A', 14)} ${pad(row.publicationDate || 'N/A', 12)} ${pad(row.verificationDate || 'N/A', 12)} ${row.freshnessStatus}`);
  }

  if (failures > 0) {
    console.error(`\n❌ ${failures} critical dataset(s) need review.`);
    process.exit(1);
  }

  console.log('\n✅ Critical published observations are within their release windows; withheld values are explicitly unavailable.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
