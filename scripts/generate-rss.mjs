#!/usr/bin/env node
/**
 * Builds public/feed.xml — RSS of critical series freshness / latest observations.
 */
import { readFile, writeFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');
const SITE = 'https://economyofpakistan.com';

async function readJson(rel) {
  return JSON.parse(await readFile(resolve(root, rel), 'utf8'));
}

function escapeXml(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

async function main() {
  const freshness = await readJson('public/data/data-freshness.json');
  const kpi = await readJson('public/data/kpi-summary.json');
  const critical = (freshness.datasets || []).filter((d) => d.critical || ['reserves', 'inflation', 'fbr-tax', 'trade', 'remittances'].includes(d.id));

  const items = [];

  for (const ds of critical) {
    const title = `${ds.label}: ${ds.latestObservation || 'update'} (${ds.status})`;
    const link = `${SITE}/${ds.id === 'fbr-tax' ? 'fiscal/fbr' : ds.id === 'inflation' ? 'prices/inflation' : ds.id === 'reserves' ? 'external/reserves' : ds.id === 'trade' ? 'external/trade' : ds.id === 'remittances' ? 'external/remittances' : 'overview/overview'}`;
    const pubDate = new Date(ds.dashboardUpdated || freshness.generatedAt || Date.now()).toUTCString();
    const desc = [
      ds.source && `Source: ${ds.source}`,
      ds.latestObservation && `Latest observation: ${ds.latestObservation}`,
      ds.dataCoverage && `Coverage: ${ds.dataCoverage}`,
      ds.reviewReason,
      ds.expectedLag,
    ].filter(Boolean).join('. ');
    items.push({ title, link, pubDate, guid: `${ds.id}-${ds.latestObservation || ds.dashboardUpdated}`, desc });
  }

  for (const ind of (kpi.indicators || []).slice(0, 8)) {
    items.push({
      title: `KPI · ${ind.label}: ${ind.value}${ind.unit ? ` ${ind.unit}` : ''} (${ind.period})`,
      link: `${SITE}/overview/overview`,
      pubDate: new Date(kpi.lastUpdated || Date.now()).toUTCString(),
      guid: `kpi-${ind.id}-${ind.period}-${ind.value}`,
      desc: [ind.changeBasis, ind.source, ind.sub].filter(Boolean).join(' · '),
    });
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
  <channel>
    <title>Pakistan Economic Dashboard — Critical series</title>
    <link>${SITE}</link>
    <description>Updates for reserves, inflation, FBR tax, trade, remittances and headline KPIs from official sources.</description>
    <language>en</language>
    <lastBuildDate>${new Date(freshness.generatedAt || Date.now()).toUTCString()}</lastBuildDate>
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

  await writeFile(resolve(root, 'public/feed.xml'), xml, 'utf8');
  console.log(`Wrote feed.xml with ${items.length} items`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
