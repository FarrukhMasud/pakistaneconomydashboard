#!/usr/bin/env node
/**
 * Publishes public/api/** — a small, documented, static data API.
 *
 * Everything the dashboard draws is already a static JSON file, so exposing it
 * under stable, versioned URLs (with CSV alongside) costs nothing and makes the
 * numbers reusable by journalists, researchers and students without scraping
 * the UI. Each endpoint carries the same source attribution and trust tier the
 * dashboard shows.
 */

import { readFile, writeFile, mkdir, rm } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { DATASETS, SOURCE_TIERS, getDatasetFreshness } from './data-catalog.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '..', 'public', 'data');
const API_DIR = resolve(__dirname, '..', 'public', 'api');
const VERSION = 'v1';

/** Candidate keys, in priority order, for the dataset's primary observation series. */
const SERIES_KEYS = ['monthly', 'weekly', 'annual', 'years', 'events', 'monthlySeries'];

function pickSeries(data) {
  for (const key of SERIES_KEYS) {
    if (Array.isArray(data[key]) && data[key].length > 0 && typeof data[key][0] === 'object') {
      return { key, rows: data[key] };
    }
  }
  // Nested {name, data:[{date,value}]} series (inflation, monetary, fiscal).
  const nested = Object.entries(data).filter(
    ([, value]) => value && typeof value === 'object' && Array.isArray(value.data) && value.data.length > 0,
  );
  if (nested.length > 0) {
    const rows = [];
    for (const [seriesKey, series] of nested) {
      for (const row of series.data) rows.push({ series: seriesKey, ...row });
    }
    return { key: 'series', rows };
  }
  return null;
}

function csvCell(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value).replace(/"/g, '""');
  const text = String(value);
  return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function toCsv(rows) {
  const columns = [];
  for (const row of rows) {
    for (const key of Object.keys(row)) {
      if (!columns.includes(key)) columns.push(key);
    }
  }
  const lines = [columns.join(',')];
  for (const row of rows) {
    lines.push(columns.map((column) => {
      const cell = csvCell(row[column]);
      return /[",\n]/.test(cell) && !cell.startsWith('"') ? `"${cell}"` : cell;
    }).join(','));
  }
  return `${lines.join('\n')}\n`;
}

async function main() {
  await rm(API_DIR, { recursive: true, force: true });
  await mkdir(resolve(API_DIR, VERSION), { recursive: true });

  const generatedAt = new Date().toISOString();
  const endpoints = [];

  for (const dataset of DATASETS) {
    const data = JSON.parse(await readFile(resolve(DATA_DIR, dataset.file), 'utf-8'));
    const freshness = getDatasetFreshness(dataset, data);
    const series = pickSeries(data);

    const jsonPath = `/api/${VERSION}/${dataset.id}.json`;
    await writeFile(
      resolve(API_DIR, VERSION, `${dataset.id}.json`),
      `${JSON.stringify({
        id: dataset.id,
        label: dataset.label,
        source: dataset.source,
        sourceUrl: dataset.sourceUrl,
        sourceType: freshness.sourceType,
        cadence: dataset.cadence,
        latestObservation: freshness.latestObservation,
        dates: {
          observation: freshness.observationDate,
          publication: freshness.publicationDate,
          verification: freshness.verificationDate,
          dashboardUpdated: freshness.dashboardUpdated,
        },
        lastUpdated: data.lastUpdated || null,
        lastChecked: data.lastChecked || null,
        licence: 'Official public data, redistributed with attribution. Cite the original institution.',
        data,
      }, null, 2)}\n`,
    );

    const endpoint = {
      id: dataset.id,
      label: dataset.label,
      json: jsonPath,
      csv: null,
      rows: series?.rows.length || 0,
      seriesKey: series?.key || null,
      source: dataset.source,
      sourceUrl: dataset.sourceUrl,
      sourceType: freshness.sourceType,
      cadence: dataset.cadence,
      latestObservation: freshness.latestObservation,
      dates: {
        observation: freshness.observationDate,
        publication: freshness.publicationDate,
        verification: freshness.verificationDate,
        dashboardUpdated: freshness.dashboardUpdated,
      },
    };

    if (series) {
      await writeFile(resolve(API_DIR, VERSION, `${dataset.id}.csv`), toCsv(series.rows));
      endpoint.csv = `/api/${VERSION}/${dataset.id}.csv`;
    }

    endpoints.push(endpoint);
  }

  // Meta endpoints so a consumer can discover provenance without scraping.
  for (const file of ['provenance.json', 'data-freshness.json', 'release-calendar.json', 'revisions.json', 'editorial-notes.json', 'update-preview.json']) {
    try {
      const raw = await readFile(resolve(DATA_DIR, file), 'utf-8');
      await writeFile(resolve(API_DIR, VERSION, file), raw);
      endpoints.push({
        id: file.replace(/\.json$/, ''),
        label: `Metadata: ${file.replace(/\.json$/, '').replace(/-/g, ' ')}`,
        json: `/api/${VERSION}/${file}`,
        csv: null,
        rows: 0,
        seriesKey: null,
        source: 'economyofpakistan.com',
        sourceUrl: 'https://economyofpakistan.com',
        sourceType: 'official-derived',
        cadence: 'Per update',
        latestObservation: null,
      });
    } catch {
      // A meta file that has not been generated yet simply is not published.
    }
  }

  await writeFile(
    resolve(API_DIR, 'index.json'),
    `${JSON.stringify({
      generatedAt,
      version: VERSION,
      title: 'economyofpakistan.com static data API',
      description: 'Every dataset the dashboard renders, published as stable JSON and CSV. No key, no rate limit, no scraping required. Please cite the issuing institution listed on each endpoint.',
      attribution: 'Data belongs to the State Bank of Pakistan, Pakistan Bureau of Statistics, Federal Board of Revenue, Finance Division, IMF and World Bank as indicated per endpoint.',
      tiers: SOURCE_TIERS,
      endpoints,
    }, null, 2)}\n`,
  );

  console.log(`✅ Published ${endpoints.length} API endpoints under public/api/${VERSION}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
