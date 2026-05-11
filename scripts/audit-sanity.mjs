#!/usr/bin/env node

import { readFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { DATASETS, getDatasetFreshness } from './data-catalog.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '..', 'public', 'data');

const MAX_AGE_DAYS = {
  Weekly: 45,
  Monthly: 150,
  'Monthly/FYTD': 180,
  'Weekly/Monthly': 75,
  'Quarterly/Annual': 540,
};

async function readJson(file) {
  return JSON.parse(await readFile(resolve(DATA_DIR, file), 'utf-8'));
}

function isIsoDate(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isIsoMonth(value) {
  return typeof value === 'string' && /^\d{4}-\d{2}$/.test(value);
}

function daysSince(value) {
  if (!isIsoDate(value) && !isIsoMonth(value)) return null;
  const date = new Date(isIsoMonth(value) ? `${value}-01T00:00:00Z` : `${value}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return null;
  return Math.floor((Date.now() - date.getTime()) / 86_400_000);
}

function assert(condition, message, failures) {
  if (!condition) failures.push(message);
}

function assertSorted(rows, datasetId, failures) {
  if (!Array.isArray(rows) || rows.length === 0) return;
  for (let i = 1; i < rows.length; i++) {
    if ((rows[i - 1].date || '') > (rows[i].date || '')) {
      failures.push(`${datasetId}: monthly/weekly rows are not sorted at index ${i}`);
      return;
    }
  }
}

async function main() {
  const failures = [];

  for (const dataset of DATASETS) {
    const data = await readJson(dataset.file);
    const freshness = getDatasetFreshness(dataset, data);

    assert(freshness.latestObservation, `${dataset.id}: missing latest observation`, failures);
    assert(freshness.dashboardUpdated, `${dataset.id}: missing dashboard update date`, failures);

    if (freshness.dashboardUpdated) {
      assert(isIsoDate(freshness.dashboardUpdated), `${dataset.id}: dashboard update is not YYYY-MM-DD`, failures);
    }

    if (data.monthly) assertSorted(data.monthly, dataset.id, failures);
    if (data.weekly) assertSorted(data.weekly, dataset.id, failures);

    const maxAge = MAX_AGE_DAYS[dataset.cadence];
    const age = daysSince(freshness.latestObservation);
    if (maxAge && age !== null) {
      assert(age <= maxAge, `${dataset.id}: latest observation ${freshness.latestObservation} is ${age} days old`, failures);
    }

    if (dataset.id === 'trade') {
      assert(data.monthly?.at(-1)?.date === freshness.latestObservation, 'trade: latest observation does not match monthly tail', failures);
      assert(data.exportCountryPeriod, 'trade: missing export country period metadata', failures);
      assert(data.importCountryPeriod, 'trade: missing import country period metadata', failures);
      assert(Array.isArray(data.topExportCountries) && data.topExportCountries.length > 0, 'trade: missing top export countries', failures);
      assert(Array.isArray(data.topImportCountries) && data.topImportCountries.length > 0, 'trade: missing top import countries', failures);
    }
  }

  if (failures.length > 0) {
    console.error('\nData sanity audit failed:\n');
    for (const failure of failures) console.error(`- ${failure}`);
    process.exit(1);
  }

  console.log(`✅ Data sanity audit passed for ${DATASETS.length} datasets`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
