#!/usr/bin/env node

import { readFile, writeFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { DATASETS, SOURCE_TIERS, getDatasetFreshness } from './data-catalog.mjs';
import { buildReleaseRow, sortReleaseRows } from './lib/release-calendar.mjs';
import { sha256 } from './lib/source-evidence.mjs';

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
  const now = new Date();
  const datasets = [];
  const releases = [];
  const optionalJson = async file => {
    try { return await readJson(file); }
    catch (error) {
      if (error.code !== 'ENOENT') throw error;
      return null;
    }
  };
  const artifacts = await optionalJson('source-artifacts.json');
  const quality = await optionalJson('data-quality.json');

  for (const dataset of DATASETS) {
    try {
      const data = await readJson(dataset.file);
      const report = quality?.datasets?.[dataset.id];
      const body = await readFile(resolve(DATA_DIR, dataset.file));
      const validation = report?.contentHash === sha256(body) ? report : null;
      const freshness = getDatasetFreshness(dataset, data, { now, checks: artifacts?.checks || {}, validation });
      datasets.push(freshness);
      releases.push(buildReleaseRow({ dataset, data, freshness, now }));
    } catch (err) {
      datasets.push({
        id: dataset.id,
        label: dataset.label,
        file: dataset.file,
        source: dataset.source,
        sourceUrl: dataset.sourceUrl,
        sourceType: dataset.sourceType || 'official-primary',
        parser: dataset.parser,
        cadence: dataset.cadence,
        critical: dataset.critical,
        latestObservation: null,
        observationDate: null,
        publicationDate: null,
        verificationDate: null,
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

  const sortedReleases = sortReleaseRows(releases);

  await writeJson('release-calendar.json', {
    generatedAt,
    description: 'Expected next-release windows. Dates marked "estimated" are derived from the observed publication history of each series on this dashboard — they are projections, not an official release calendar. Dates marked "announced" come from the source institution itself.',
    overdueCount: sortedReleases.filter(row => row.status === 'overdue').length,
    dueCount: sortedReleases.filter(row => row.status === 'due').length,
    releases: sortedReleases,
  });

  await writeJson('data-freshness.json', {
    generatedAt,
    dateSemantics: {
      observationDate: 'When the measured economic period ended.',
      publicationDate: 'When the issuing institution published the source, when known.',
      verificationDate: 'When this dashboard last checked the source.',
      dashboardUpdated: 'When the dashboard data content last changed.',
    },
    status: datasets.some(d => d.status !== 'fresh') ? 'needs-review' : 'fresh',
    tiers: SOURCE_TIERS,
    datasets,
  });

  console.log(`✅ Generated source-manifest.json, data-freshness.json and release-calendar.json for ${datasets.length} datasets`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
