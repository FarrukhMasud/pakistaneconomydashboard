#!/usr/bin/env node
/**
 * Builds public/sitemap.xml from SEO_ROUTES and data-freshness lastmod dates.
 */
import { readFile, writeFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { SEO_ROUTES, SITE_URL, absoluteUrl, lastmodForRoute } from './lib/seo-routes.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, '..');

function formatPriority(value) {
  return Number(value).toFixed(1);
}

export function buildSitemapXml(routes, freshness) {
  const urls = routes.map((route) => {
    const lastmod = lastmodForRoute(route, freshness);
    const lines = [
      '  <url>',
      `    <loc>${absoluteUrl(route.path)}</loc>`,
    ];
    if (lastmod) lines.push(`    <lastmod>${lastmod}</lastmod>`);
    lines.push(`    <changefreq>${route.changefreq}</changefreq>`);
    lines.push(`    <priority>${formatPriority(route.priority)}</priority>`);
    lines.push('  </url>');
    return lines.join('\n');
  });

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.join('\n')}
</urlset>
`;
}

async function main() {
  let freshness = { generatedAt: new Date().toISOString(), datasets: [] };
  try {
    freshness = JSON.parse(
      await readFile(resolve(root, 'public/data/data-freshness.json'), 'utf8'),
    );
  } catch {
    console.warn('data-freshness.json missing; sitemap lastmod will use today');
  }

  const xml = buildSitemapXml(SEO_ROUTES, freshness);
  const out = resolve(root, 'public/sitemap.xml');
  await writeFile(out, xml, 'utf8');
  console.log(`Wrote sitemap.xml with ${SEO_ROUTES.length} URLs (${SITE_URL})`);
}

const isDirect = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
