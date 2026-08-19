import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  SEO_ROUTES,
  SITE_URL,
  OG_IMAGE_URL,
  getSeoRoute,
  lastmodForRoute,
} from '../lib/seo-routes.mjs';
import { applySeoToHtml, htmlOutputPath } from '../lib/seo-html.mjs';
import { buildSitemapXml } from '../generate-sitemap.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');

function extractAppRoutes(source) {
  const nav = source.match(/const NAV_GROUPS = \[([\s\S]*?)\];/);
  assert.ok(nav, 'NAV_GROUPS not found in App.jsx');
  const routes = [];
  const blocks = nav[1].split(/id: '([a-z0-9-]+)',\s*label: '[^']+',\s*icon:/);
  for (let i = 1; i < blocks.length; i += 2) {
    const groupId = blocks[i];
    const body = blocks[i + 1] || '';
    const sections = [...body.matchAll(/\{ id: '([a-z0-9-]+)', label: '[^']+', component:/g)]
      .map((match) => match[1]);
    assert.ok(sections.length, `group ${groupId} has no sections`);
    for (const sectionId of sections) routes.push(`/${groupId}/${sectionId}`);
  }
  return routes;
}

const FIXTURE = `<!doctype html>
<html lang="en">
  <head>
    <title>Old Title</title>
    <meta name="description" content="Old description" />
    <link rel="canonical" href="https://economyofpakistan.com/" />
    <meta property="og:title" content="Old Title" />
    <meta property="og:description" content="Old description" />
    <meta property="og:url" content="https://economyofpakistan.com/" />
    <meta property="og:image" content="https://economyofpakistan.com/og-image.svg" />
    <meta property="og:image:alt" content="old" />
    <meta name="twitter:title" content="Old Title" />
    <meta name="twitter:description" content="Old description" />
    <meta name="twitter:image" content="https://economyofpakistan.com/og-image.svg" />
    <script type="application/ld+json">
    {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "WebSite",
          "@id": "https://economyofpakistan.com/#website",
          "url": "https://economyofpakistan.com/",
          "name": "Pakistan Economic Dashboard"
        }
      ]
    }
    </script>
  </head>
  <body>
    <div id="root">
      <main><h1>Old</h1><p>Old copy</p></main>
    </div>
  </body>
</html>`;

test('every App.jsx section has SEO metadata', () => {
  const appRoutes = extractAppRoutes(readFileSync(resolve(root, 'src/App.jsx'), 'utf8'));
  const seoPaths = new Set(SEO_ROUTES.map((route) => route.path));
  assert.ok(seoPaths.has('/'));
  const missing = appRoutes.filter((path) => !seoPaths.has(path));
  assert.deepEqual(missing, [], `add SEO_ROUTES entries for: ${missing.join(', ')}`);
});

test('SEO_ROUTES do not invent sections missing from App.jsx', () => {
  const appRoutes = new Set(extractAppRoutes(readFileSync(resolve(root, 'src/App.jsx'), 'utf8')));
  const extra = SEO_ROUTES
    .filter((route) => route.path !== '/')
    .map((route) => route.path)
    .filter((path) => !appRoutes.has(path));
  assert.deepEqual(extra, [], `remove stale SEO_ROUTES: ${extra.join(', ')}`);
});

test('SEO paths, titles and descriptions are unique', () => {
  const paths = SEO_ROUTES.map((route) => route.path);
  assert.equal(new Set(paths).size, paths.length);
  const titles = SEO_ROUTES.map((route) => route.title);
  assert.equal(new Set(titles).size, titles.length);
  const descriptions = SEO_ROUTES.map((route) => route.description);
  assert.equal(new Set(descriptions).size, descriptions.length);
});

test('getSeoRoute normalizes trailing slashes and unknown paths', () => {
  assert.equal(getSeoRoute('/external/reserves/').path, '/external/reserves');
  assert.equal(getSeoRoute('/nope').path, '/');
});

test('lastmodForRoute uses the newest mapped dataset date', () => {
  const route = getSeoRoute('/external/reserves');
  const lastmod = lastmodForRoute(route, {
    generatedAt: '2026-01-01T00:00:00Z',
    datasets: [
      { id: 'reserves', dashboardUpdated: '2026-08-17', observationDate: '2026-08-07' },
      { id: 'reserves-adequacy', dashboardUpdated: '2026-08-18' },
    ],
  });
  assert.equal(lastmod, '2026-08-18');
});

test('applySeoToHtml rewrites title, canonical, OG tags and fallback copy', () => {
  const route = getSeoRoute('/external/reserves');
  const html = applySeoToHtml(FIXTURE, route);
  assert.match(html, /<title>Pakistan Foreign Exchange Reserves — Weekly SBP Data<\/title>/);
  assert.match(html, /<link rel="canonical" href="https:\/\/economyofpakistan.com\/external\/reserves" \/>/);
  assert.match(html, /property="og:url" content="https:\/\/economyofpakistan.com\/external\/reserves"/);
  assert.match(html, new RegExp(`property="og:image" content="${OG_IMAGE_URL}"`));
  assert.doesNotMatch(html, /og-image\.svg/);
  assert.match(html, /<h1>Pakistan Foreign Exchange Reserves<\/h1>/);
  assert.doesNotMatch(html, /<title>Old Title<\/title>/);
  const data = JSON.parse(html.match(/<script type="application\/ld\+json">\s*([\s\S]*?)\s*<\/script>/)[1]);
  assert.equal(data['@graph'].some((node) => node['@type'] === 'WebPage' && node.url === `${SITE_URL}/external/reserves`), true);
});

test('applySeoToHtml works on the real index.html', () => {
  const index = readFileSync(resolve(root, 'index.html'), 'utf8');
  const route = getSeoRoute('/prices/inflation');
  const html = applySeoToHtml(index, route);
  assert.match(html, /<title>Pakistan Inflation \(CPI, SPI, WPI\) — Latest Official Data<\/title>/);
  assert.match(html, /property="og:image" content="https:\/\/economyofpakistan.com\/og-image.png"/);
  assert.match(html, /<h1>Pakistan Inflation<\/h1>/);
});

test('applySeoToHtml is idempotent on the homepage', () => {
  const index = readFileSync(resolve(root, 'index.html'), 'utf8');
  const html = applySeoToHtml(index, getSeoRoute('/'));
  assert.match(html, /<link rel="canonical" href="https:\/\/economyofpakistan.com\/" \/>/);
  assert.match(html, /<h1>Pakistan Economic Dashboard<\/h1>/);
});

test('committed sitemap lists every SEO route', () => {
  const sitemap = readFileSync(resolve(root, 'public/sitemap.xml'), 'utf8');
  const freshness = JSON.parse(readFileSync(resolve(root, 'public/data/data-freshness.json'), 'utf8'));
  const expected = buildSitemapXml(SEO_ROUTES, freshness);
  for (const route of SEO_ROUTES) {
    assert.match(sitemap, new RegExp(`<loc>${absoluteEscaped(route.path)}</loc>`));
  }
  assert.equal(sitemap, expected);
});

test('htmlOutputPath writes pretty Cloudflare asset names', () => {
  assert.equal(htmlOutputPath(getSeoRoute('/')), 'index.html');
  assert.equal(htmlOutputPath(getSeoRoute('/external/reserves')), 'external/reserves.html');
});

function absoluteEscaped(path) {
  const url = path === '/' ? `${SITE_URL}/` : `${SITE_URL}${path}`;
  return url.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
