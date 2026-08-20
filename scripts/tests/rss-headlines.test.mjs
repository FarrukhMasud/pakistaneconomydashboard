import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  KPI_PATHS,
  formatHeadlineTitle,
  buildHeadlineItems,
} from '../lib/rss-headlines.mjs';
import { buildRssXml } from '../generate-rss.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

test('headline titles lead with the figure and the change', () => {
  const title = formatHeadlineTitle({
    label: 'Foreign Reserves (Total)',
    value: 22.5,
    unit: '$ Billion',
    period: '2026-08-07',
    change: 0.02,
    changeUnit: '$B',
  });
  assert.match(title, /22\.5 USD bn/);
  assert.match(title, /\+0\.02 USD bn/);
  assert.match(title, /7 Aug 2026/);
  assert.doesNotMatch(title, /\(fresh\)|\(stale\)/);
});

test('every KPI in the live summary has a section path', () => {
  const kpi = JSON.parse(readFileSync(resolve(root, 'public/data/kpi-summary.json'), 'utf8'));
  const missing = (kpi.indicators || []).map((row) => row.id).filter((id) => !KPI_PATHS[id]);
  assert.deepEqual(missing, [], `add KPI_PATHS for: ${missing.join(', ')}`);
});

test('RSS items link to the matching section, not a generic overview dump', () => {
  const items = buildHeadlineItems({
    lastUpdated: '2026-08-18',
    indicators: [
      { id: 'reserves', label: 'Foreign Reserves (Total)', value: 22.5, unit: '$B', period: '2026-08-07', change: 0.02, changeUnit: '$B' },
      { id: 'inflation', label: 'CPI Inflation (YoY)', value: 9.2, unit: '%', period: '2026-07', change: -1.9, changeUnit: 'pp' },
    ],
  });
  assert.equal(items[0].link, 'https://economyofpakistan.com/external/reserves');
  assert.equal(items[1].link, 'https://economyofpakistan.com/prices/inflation');
  assert.match(items[1].title, /9\.2 ?%/);
  assert.match(items[1].title, /-1\.9pp/);
});

test('committed feed.xml is generated from headline KPIs', () => {
  const kpi = JSON.parse(readFileSync(resolve(root, 'public/data/kpi-summary.json'), 'utf8'));
  const feed = readFileSync(resolve(root, 'public/feed.xml'), 'utf8');
  const expected = buildRssXml(kpi, kpi.lastUpdated);
  assert.equal(feed, expected);
  assert.match(feed, /Headline indicators/);
  assert.doesNotMatch(feed, /\(fresh\)/);
});
