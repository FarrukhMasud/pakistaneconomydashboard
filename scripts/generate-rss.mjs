#!/usr/bin/env node
/**
 * Builds public/feed.xml — RSS of headline KPI figures, not mere freshness flags.
 */
import { readFile, writeFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { SITE_URL } from './lib/seo-routes.mjs';
import { buildHeadlineItems } from './lib/rss-headlines.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function escapeXml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function buildRssXml(kpiSummary, generatedAt = kpiSummary.lastUpdated) {
  const items = buildHeadlineItems(kpiSummary);
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Pakistan Economic Dashboard — Headline indicators</title>
    <link>${SITE_URL}</link>
    <description>Latest official figures for reserves, inflation, remittances, FBR tax, the rupee and other headline KPIs — with the change, not just a freshness flag.</description>
    <language>en</language>
    <lastBuildDate>${new Date(generatedAt || Date.now()).toUTCString()}</lastBuildDate>
${items.map((item) => `    <item>
      <title>${escapeXml(item.title)}</title>
      <link>${escapeXml(item.link)}</link>
      <guid isPermaLink="false">${escapeXml(item.guid)}</guid>
      <pubDate>${escapeXml(item.pubDate)}</pubDate>
      <description>${escapeXml(item.desc)}</description>
    </item>`).join('\n')}
  </channel>
</rss>
`;
}

async function main() {
  const kpi = JSON.parse(await readFile(resolve(root, 'public/data/kpi-summary.json'), 'utf8'));
  const xml = buildRssXml(kpi, kpi.lastUpdated);
  await writeFile(resolve(root, 'public/feed.xml'), xml, 'utf8');
  console.log(`Wrote feed.xml with ${(kpi.indicators || []).length} headline items`);
}

const isDirect = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
