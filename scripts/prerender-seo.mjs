#!/usr/bin/env node
/**
 * Writes one HTML document per SEO route into dist/ so crawlers and
 * social previews see unique titles without executing JavaScript.
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SEO_ROUTES } from './lib/seo-routes.mjs';
import { applySeoToHtml, htmlOutputPath } from './lib/seo-html.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export async function prerenderSeo(distDir = resolve(root, 'dist')) {
  const indexPath = resolve(distDir, 'index.html');
  const index = await readFile(indexPath, 'utf8');
  for (const route of SEO_ROUTES) {
    const html = applySeoToHtml(index, route);
    const out = resolve(distDir, htmlOutputPath(route));
    await mkdir(dirname(out), { recursive: true });
    await writeFile(out, html, 'utf8');
  }
  console.log(`SEO prerender: wrote ${SEO_ROUTES.length} HTML documents`);
}

const isDirect = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isDirect) {
  prerenderSeo().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
