/**
 * Per-figure provenance store.
 *
 * Accuracy is only half the promise - a reader must also be able to trace any
 * number on screen back to the exact document, sheet and cell it came from.
 * Parsers call `recordProvenance()` as they extract each headline figure and
 * the pipeline flushes the result to `public/data/provenance.json`, which the
 * UI reads to render its "cite this figure" popover.
 *
 * Entries are merged (not replaced) across partial pipeline runs so that
 * running only one parser does not erase citations produced by the others.
 */

import { readFile, writeFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';
import { resolveSource, allSources } from './source-docs.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT_PATH = resolve(__dirname, '..', '..', 'public', 'data', 'provenance.json');

let figures = null;
let sourcesUsed = null;

async function ensureLoaded() {
  if (figures) return;
  figures = {};
  sourcesUsed = new Set();
  try {
    const raw = JSON.parse(await readFile(OUT_PATH, 'utf-8'));
    figures = raw.figures || {};
    for (const f of Object.values(figures)) if (f.sourceId) sourcesUsed.add(f.sourceId);
  } catch {
    // First run - start from an empty registry.
  }
}

/** Drop everything in memory (used by tests). */
export function resetProvenance() {
  figures = {};
  sourcesUsed = new Set();
}

/**
 * Record where a displayed figure came from.
 *
 * @param {string} key       Stable dot-path id, e.g. "fdi.fytd.current".
 * @param {object} entry
 * @param {string} entry.label       Human description of the figure.
 * @param {string} entry.sourceKey   Key into scripts/lib/source-docs.mjs.
 * @param {string} [entry.sheet]     Worksheet name.
 * @param {string} [entry.location]  Row/column description within the sheet.
 * @param {string} [entry.period]    Reporting period the figure covers.
 * @param {string} [entry.status]    final | provisional | revised | estimate
 * @param {string} [entry.unit]      Unit of the recorded value.
 * @param {number} [entry.value]     The value published to the dashboard.
 * @param {string} [entry.note]      Any caveat a reader must know.
 * @param {string[]} [entry.derivedFrom] Other provenance keys this is computed from.
 */
export async function recordProvenance(key, entry) {
  await ensureLoaded();
  const src = resolveSource(entry.sourceKey);
  sourcesUsed.add(src.id);
  figures[key] = {
    label: entry.label,
    sourceId: src.id,
    sheet: entry.sheet ?? null,
    location: entry.location ?? null,
    period: entry.period ?? null,
    status: entry.status ?? 'final',
    unit: entry.unit ?? null,
    value: entry.value ?? null,
    derivedFrom: entry.derivedFrom ?? null,
    note: entry.note ?? null,
    retrievedAt: entry.retrievedAt || new Date().toISOString().slice(0, 10),
  };
}

/** Write provenance.json. Returns the number of cited figures. */
export async function flushProvenance() {
  await ensureLoaded();
  const sources = {};
  const catalog = Object.values(allSources());
  for (const id of [...sourcesUsed].sort()) {
    const doc = catalog.find((d) => d.id === id);
    if (doc) sources[id] = doc;
  }
  const payload = {
    generatedAt: new Date().toISOString(),
    description:
      'Machine-readable citation for every headline figure on the dashboard. Each entry names the publishing institution, the exact source document, the worksheet and the row/column it was read from.',
    sources,
    figures: Object.fromEntries(Object.entries(figures).sort(([a], [b]) => a.localeCompare(b))),
  };
  await writeFile(OUT_PATH, JSON.stringify(payload, null, 2) + '\n');
  return Object.keys(figures).length;
}

/** Read-only view of what has been recorded so far (used by tests/audits). */
export function currentProvenance() {
  return figures ? { ...figures } : {};
}
