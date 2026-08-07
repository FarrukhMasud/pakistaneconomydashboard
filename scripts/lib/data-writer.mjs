/**
 * Canonical writer for everything under public/data/.
 *
 * Two problems this solves:
 *
 * 1. `lastUpdated` used to advance on every pipeline run even when the numbers
 *    were byte-identical, so a dataset that had silently stopped refreshing
 *    still looked fresh. Here `lastUpdated` only moves when the *content*
 *    changes; `lastChecked` records the most recent successful run.
 *
 * 2. Official Pakistani statistics are heavily revised - provisional (P)
 *    figures become revised (R) and then final, often months later. Silently
 *    overwriting them destroys the audit trail. Every restatement of a
 *    previously published value is therefore appended to revisions.json.
 */

import { readFile, writeFile } from 'fs/promises';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = resolve(__dirname, '..', '..', 'public', 'data');
const REVISIONS_PATH = resolve(DATA_DIR, 'revisions.json');

/** Keys that change on every run and carry no analytical meaning. */
const VOLATILE_KEYS = new Set([
  'lastUpdated',
  'lastChecked',
  'generatedAt',
  'retrievedAt',
  'lastVerified',
  'updatedAt',
]);

/** Keys used to identify a row inside an array of observations. */
const ROW_KEYS = ['date', 'month', 'year', 'fyLabel', 'country', 'sector', 'name', 'key', 'id'];

const MAX_REVISION_ENTRIES = 800;
const MIN_RELATIVE_CHANGE = 0.0005; // ignore pure floating-point noise

function rowKeyOf(item) {
  if (!item || typeof item !== 'object' || Array.isArray(item)) return null;
  for (const k of ROW_KEYS) {
    if (item[k] !== undefined && item[k] !== null) return `${k}=${item[k]}`;
  }
  return null;
}

function representsNewObservation(before, after, rowKey) {
  if (!rowKey.startsWith('id=')) return false;
  for (const key of ['date', 'month', 'period', 'asOf', 'latestMonth']) {
    if (before[key] != null && after[key] != null && before[key] !== after[key]) return true;
  }
  return false;
}

/**
 * Walk two JSON trees together and collect changes to numeric values that
 * already existed in the previous version. Additions are not revisions.
 */
function collectRevisions(before, after, path = '', out = []) {
  if (before === undefined || after === undefined) return out;

  if (typeof before === 'number' && typeof after === 'number') {
    if (before !== after) {
      const denom = Math.abs(before) || 1;
      if (Math.abs(after - before) / denom >= MIN_RELATIVE_CHANGE) {
        out.push({ path, from: before, to: after });
      }
    }
    return out;
  }

  if (Array.isArray(before) && Array.isArray(after)) {
    const keyed = before.every((x) => rowKeyOf(x)) && after.every((x) => rowKeyOf(x));
    if (keyed) {
      const afterByKey = new Map(after.map((x) => [rowKeyOf(x), x]));
      for (const item of before) {
        const k = rowKeyOf(item);
        const next = afterByKey.get(k);
        if (next && !representsNewObservation(item, next, k)) {
          collectRevisions(item, next, `${path}[${k}]`, out);
        }
      }
    } else {
      const n = Math.min(before.length, after.length);
      for (let i = 0; i < n; i++) collectRevisions(before[i], after[i], `${path}[${i}]`, out);
    }
    return out;
  }

  if (before && after && typeof before === 'object' && typeof after === 'object') {
    for (const key of Object.keys(before)) {
      if (VOLATILE_KEYS.has(key)) continue;
      if (!(key in after)) continue;
      collectRevisions(before[key], after[key], path ? `${path}.${key}` : key, out);
    }
  }
  return out;
}

/** Deep copy with volatile keys stripped, for content comparison. */
function stripVolatile(value) {
  if (Array.isArray(value)) return value.map(stripVolatile);
  if (value && typeof value === 'object') {
    const out = {};
    for (const key of Object.keys(value).sort()) {
      if (VOLATILE_KEYS.has(key)) continue;
      out[key] = stripVolatile(value[key]);
    }
    return out;
  }
  return value;
}

async function readJsonSafe(path) {
  try {
    return JSON.parse(await readFile(path, 'utf-8'));
  } catch {
    return null;
  }
}

async function appendRevisions(dataset, revisions, today) {
  if (revisions.length === 0) return 0;
  const log = (await readJsonSafe(REVISIONS_PATH)) || { entries: [] };
  const entries = Array.isArray(log.entries) ? log.entries : [];

  for (const r of revisions) {
    entries.push({
      date: today,
      dataset,
      path: r.path,
      from: r.from,
      to: r.to,
      changePct: r.from === 0 ? null : Math.round(((r.to - r.from) / Math.abs(r.from)) * 1000) / 10,
    });
  }

  entries.sort((a, b) => (a.date === b.date ? 0 : a.date < b.date ? 1 : -1));
  const trimmed = entries.slice(0, MAX_REVISION_ENTRIES);

  await writeFile(
    REVISIONS_PATH,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        description:
          'Every restatement of a previously published figure. Pakistani official statistics are routinely revised from provisional to final; this log preserves what changed, when, and by how much.',
        entryCount: trimmed.length,
        entries: trimmed,
      },
      null,
      2,
    ) + '\n',
  );
  return revisions.length;
}

/**
 * Write a dataset file, maintaining honest freshness metadata and the
 * revision log.
 *
 * @param {string} filename e.g. "fdi.json"
 * @param {object} data     the full document to write (may include lastUpdated)
 * @param {object} [opts]
 * @param {boolean} [opts.trackRevisions=true]
 * @returns {Promise<{changed:boolean, revisions:number}>}
 */
export async function writeDataFile(filename, data, opts = {}) {
  const { trackRevisions = true } = opts;
  const path = resolve(DATA_DIR, filename);
  const today = new Date().toISOString().slice(0, 10);
  const previous = await readJsonSafe(path);

  const changed =
    previous === null ||
    JSON.stringify(stripVolatile(previous)) !== JSON.stringify(stripVolatile(data));

  const output = {
    ...data,
    // `lastUpdated` answers "when did these numbers last change?" - not
    // "when did the job last run", which is what `lastChecked` answers.
    lastUpdated: changed ? today : previous?.lastUpdated || today,
    lastChecked: today,
  };

  let revisionCount = 0;
  if (changed && previous && trackRevisions) {
    const dataset = filename.replace(/\.json$/, '');
    const revisions = collectRevisions(previous, data);
    revisionCount = await appendRevisions(dataset, revisions, today);
  }

  await writeFile(path, JSON.stringify(output, null, 2) + '\n');
  return { changed, revisions: revisionCount };
}

// Exported for unit tests.
export const __test__ = { collectRevisions, stripVolatile, rowKeyOf };
