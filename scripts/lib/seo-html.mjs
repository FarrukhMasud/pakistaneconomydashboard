import { escapeHtml } from '../../src/utils/escapeHtml.js';
import {
  OG_IMAGE_HEIGHT,
  OG_IMAGE_URL,
  OG_IMAGE_WIDTH,
  SITE_URL,
  absoluteUrl,
} from './seo-routes.mjs';

const TITLE_RE = new RegExp('<title>[\\s\\S]*?</title>');
const CANONICAL_RE = new RegExp('<link\\b[^>]*rel="canonical"[^>]*>', 'i');
const MAIN_RE = new RegExp('<main\\b[\\s\\S]*?</main>');
const LD_JSON_RE = new RegExp('<script type="application/ld\\+json">\\s*([\\s\\S]*?)\\s*</script>');

function replaceFirst(html, pattern, replacement) {
  if (!pattern.test(html)) {
    throw new Error(`SEO HTML rewrite missed pattern: ${pattern}`);
  }
  pattern.lastIndex = 0;
  return html.replace(pattern, replacement);
}

function replaceMeta(html, attr, key, content) {
  const pattern = new RegExp(
    `<meta\\b[^>]*${attr}="${key}"[^>]*>`,
    'i',
  );
  const tag = `    <meta ${attr}="${key}" content="${escapeHtml(content)}" />`;
  if (!pattern.test(html)) {
    return html.replace('</head>', `${tag}\n  </head>`);
  }
  return html.replace(pattern, tag);
}

function fallbackMain(route) {
  return `<main style="max-width:760px;margin:0 auto;padding:2rem 1.25rem;font-family:Inter,system-ui,sans-serif;">
        <h1>${escapeHtml(route.heading)}</h1>
        <p>${escapeHtml(route.summary)}</p>
        <p>
          Official sources: the State Bank of Pakistan (SBP), Pakistan Bureau of
          Statistics (PBS), the Federal Board of Revenue (FBR) and the Finance Division.
        </p>
        <p><a href="/">Pakistan Economic Dashboard</a> — enable JavaScript to view the interactive charts.</p>
      </main>`;
}

function withWebPage(html, route, url) {
  if (!LD_JSON_RE.test(html)) {
    throw new Error('SEO HTML rewrite missed JSON-LD script');
  }
  LD_JSON_RE.lastIndex = 0;
  return html.replace(
    LD_JSON_RE,
    (_, json) => {
      const data = JSON.parse(json);
      const graph = Array.isArray(data['@graph']) ? [...data['@graph']] : [];
      const page = {
        '@type': 'WebPage',
        '@id': `${url}#webpage`,
        url,
        name: route.title,
        description: route.description,
        isPartOf: { '@id': `${SITE_URL}/#website` },
        inLanguage: 'en',
        primaryImageOfPage: OG_IMAGE_URL,
      };
      const existing = graph.findIndex((node) => node['@type'] === 'WebPage');
      if (existing >= 0) graph[existing] = page;
      else graph.splice(1, 0, page);
      const pretty = JSON.stringify({ ...data, '@graph': graph }, null, 2)
        .split('\n')
        .map((line, index) => (index === 0 ? line : `    ${line}`))
        .join('\n');
      return `<script type="application/ld+json">\n    ${pretty}\n    </script>`;
    },
  );
}

export function applySeoToHtml(html, route) {
  const url = absoluteUrl(route.path);
  let next = html;
  next = replaceFirst(next, TITLE_RE, `<title>${escapeHtml(route.title)}</title>`);
  next = replaceMeta(next, 'name', 'description', route.description);
  next = replaceFirst(next, CANONICAL_RE, `<link rel="canonical" href="${url}" />`);
  next = replaceMeta(next, 'property', 'og:title', route.title);
  next = replaceMeta(next, 'property', 'og:description', route.description);
  next = replaceMeta(next, 'property', 'og:url', url);
  next = replaceMeta(next, 'property', 'og:image', OG_IMAGE_URL);
  next = replaceMeta(next, 'property', 'og:image:alt', route.heading);
  next = replaceMeta(next, 'property', 'og:image:width', String(OG_IMAGE_WIDTH));
  next = replaceMeta(next, 'property', 'og:image:height', String(OG_IMAGE_HEIGHT));
  next = replaceMeta(next, 'property', 'og:image:type', 'image/png');
  next = replaceMeta(next, 'name', 'twitter:title', route.title);
  next = replaceMeta(next, 'name', 'twitter:description', route.description);
  next = replaceMeta(next, 'name', 'twitter:image', OG_IMAGE_URL);
  next = withWebPage(next, route, url);
  next = replaceFirst(next, MAIN_RE, fallbackMain(route));
  return next;
}

export function htmlOutputPath(route) {
  if (route.path === '/') return 'index.html';
  return `${route.path.replace(/^\//, '')}.html`;
}
