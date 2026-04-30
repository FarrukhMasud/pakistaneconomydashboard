#!/usr/bin/env node

import { readFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { DATASETS, getDatasetFreshness } from './data-catalog.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '..', 'public', 'data');
const SBP_INDEX = 'https://www.sbp.org.pk/ecodata/index2.asp';

async function readJson(file) {
  return JSON.parse(await readFile(resolve(DATA_DIR, file), 'utf-8'));
}

async function fetchSbpIndex() {
  const res = await fetch(SBP_INDEX, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
  });
  if (!res.ok) throw new Error(`SBP index HTTP ${res.status}`);
  return res.text();
}

function compact(text) {
  return text.replace(/<[^>]*>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/\s+/g, ' ').trim();
}

function findSourceUpdate(indexText, sourceFile) {
  if (!sourceFile) return null;
  const at = indexText.toLowerCase().indexOf(sourceFile.toLowerCase());
  if (at < 0) return null;
  const nearby = compact(indexText.slice(at, at + 700));
  const match = nearby.match(/\b(?:Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+\d{1,2}\s*,?\s*\d{4}\b/i);
  return match?.[0] || null;
}

function pad(value, width) {
  return String(value ?? '').slice(0, width).padEnd(width);
}

async function main() {
  const rows = [];
  let sbpIndex = '';

  try {
    sbpIndex = await fetchSbpIndex();
  } catch (err) {
    console.warn(`⚠️  Could not fetch SBP index for source-published dates: ${err.message}`);
  }

  for (const dataset of DATASETS) {
    const data = await readJson(dataset.file);
    const freshness = getDatasetFreshness(dataset, data);
    const sourceUpdated = findSourceUpdate(sbpIndex, dataset.sourceFile);
    rows.push({ ...freshness, sourceUpdated });
  }

  console.log('\nPakistan Economic Dashboard — Data Freshness Audit\n');
  console.log(`${pad('Dataset', 27)} ${pad('Latest', 18)} ${pad('Dashboard', 12)} ${pad('Source updated', 16)} Status`);
  console.log('-'.repeat(92));

  let failures = 0;
  for (const row of rows) {
    const ok = row.latestObservation && row.dashboardUpdated;
    if (!ok && row.critical) failures++;
    console.log(`${pad(row.label, 27)} ${pad(row.latestObservation || 'N/A', 18)} ${pad(row.dashboardUpdated || 'N/A', 12)} ${pad(row.sourceUpdated || 'API/manual', 16)} ${ok ? 'OK' : 'REVIEW'}`);
  }

  if (failures > 0) {
    console.error(`\n❌ ${failures} critical dataset(s) need review.`);
    process.exit(1);
  }

  console.log('\n✅ All critical datasets have current dashboard metadata. Check source-updated dates above for release cadence.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
