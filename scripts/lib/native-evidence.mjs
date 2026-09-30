import { readFile } from 'node:fs/promises';
import { basename, resolve } from 'node:path';
import XLSX from 'xlsx';
import { parsePdfTextItems } from '../pdf-text.mjs';
import { sourceNumber } from './ingestion-validation.mjs';

const METADATA = new Set(['year', 'fy', 'fyYear', 'month', 'fiscalYear', 'expectedMonths', 'rawValue']);
const SIDECARS = new Set(['evidence', 'sourceEvidence', 'observations', 'publication', 'publicationEvidence', 'reconciliation', 'countryReconciliation', 'monthlyReconciliation']);
const SUMS = new Set(['sum', 'sum of remainder sectors', 'sum of remainder countries', 'sum over exact printed BOP window', 'sum of printed monthly IT columns in exact FYTD coverage']);

export function calculateEvidence(derivation, inputs) {
  if (!inputs.length || inputs.some(value => !Number.isFinite(value))) throw new Error('Incomplete derived inputs');
  if (SUMS.has(derivation)) return inputs.reduce((a, b) => a + b, 0);
  if (derivation === 'US$ million divided by 1000' || derivation === 'US$ million divided by 1000 to US$ billion') {
    if (inputs.length !== 1) throw new Error('Reserve conversion requires exactly one input');
    return inputs[0] / 1000;
  }
  if (derivation === 'computer services less named components (all inputs in US$ million)') {
    return inputs[0] - inputs.slice(1).reduce((a, b) => a + b, 0);
  }
  if (derivation === 'SBP reserves / average of 12 consecutive monthly BOP goods imports') {
    if (inputs.length !== 13 || inputs.slice(1).some(value => value <= 0)) throw new Error('Import cover requires 12 positive monthly imports');
    return inputs[0] / (inputs.slice(1).reduce((a, b) => a + b, 0) / 12);
  }
  throw new Error(`Unknown calculation: ${derivation}`);
}

export function assertPublishedValue(value, expected, path) {
  const tolerance = Number.EPSILON * Math.max(1, Math.abs(expected), Math.abs(value)) * 32;
  const candidates = [expected, ...[0, 1, 2, 4].map(places => Math.round(expected * 10 ** places) / 10 ** places)];
  if (!Number.isFinite(value) || !Number.isFinite(expected) || !candidates.some(candidate => Math.abs(candidate - value) <= tolerance)) {
    throw new Error(`${path}: published ${value} does not match archived extraction ${expected}`);
  }
}

export function createNativeVerifier(artifacts, publicDir) {
  const cache = new Map();
  async function load(receipt) {
    if (!cache.has(receipt.artifactId)) {
      const file = resolve(publicDir, 'source-evidence', basename(receipt.path));
      cache.set(receipt.artifactId, (async () => {
        if (/\.xlsx?$/.test(receipt.path)) return XLSX.read(await readFile(file), { type: 'buffer' });
        if (/\.pdf$/.test(receipt.path)) return parsePdfTextItems(file);
        if (/\.json$/.test(receipt.path)) return JSON.parse(await readFile(file, 'utf8'));
        throw new Error(`Unsupported native evidence format: ${receipt.sourceKey}`);
      })());
    }
    return cache.get(receipt.artifactId);
  }
  async function extract(evidence) {
    if (evidence?.derivation) {
      const values = await Promise.all((evidence.inputs || []).map(extract));
      return calculateEvidence(evidence.derivation, values);
    }
    const receipt = artifacts.get(evidence?.artifactId);
    const loc = evidence?.locator;
    if (!receipt || !loc) throw new Error('Numeric observation lacks an immutable receipt and exact locator');
    const source = await load(receipt);
    let raw;
    if (loc.sheet) {
      if (!Number.isInteger(loc.row) || loc.row < 1 || !Number.isInteger(loc.column) || loc.column < 1) throw new Error('Invalid one-based cell locator');
      const address = XLSX.utils.encode_cell({ r: loc.row - 1, c: loc.column - 1 });
      if (address !== loc.cell) throw new Error('Cell address disagrees with row/column locator');
      raw = source.Sheets[loc.sheet]?.[address]?.v ?? null;
    } else if (loc.seriesKey) {
      const row = source.rows?.[loc.row - 1];
      if (receipt.sourceKey !== loc.seriesKey || !row
        || row[loc.columns?.seriesKey - 1] !== loc.seriesKey
        || row[loc.columns?.date - 1] !== loc.observationDate
        || !/^(?:Observation Value|Value)$/i.test(source.columns?.[loc.column - 1] || '')
        || loc.columns?.value !== loc.column) throw new Error('API locator disagrees with the archived series/date/value column');
      raw = row[loc.column - 1];
    } else if (loc.countryCode) {
      const rows = source[1]?.filter(row => row.countryiso3code === loc.countryCode
        && row.date === String(loc.observationDate) && row.indicator.id === loc.indicator);
      if (rows?.length !== 1 || receipt.sourceKey !== loc.indicator) throw new Error('World Bank locator is missing or ambiguous');
      raw = rows[0].value;
    } else if (loc.page) {
      const items = source.filter(item => item.page === loc.page && item.x === loc.x && item.y === loc.y && item.text.trim());
      if (items.length !== 1) throw new Error('PDF coordinate is missing or ambiguous');
      raw = items[0].text;
    } else {
      throw new Error('Unsupported numeric source locator');
    }
    const value = sourceNumber(raw, { required: false });
    const recorded = evidence.rawValue ?? loc.rawValue;
    if (recorded !== undefined && sourceNumber(recorded, { required: false }) !== value) throw new Error('Recorded raw value differs from immutable source');
    return value === null ? null : value * (evidence.scale ?? 1);
  }
  return extract;
}

export async function auditNativeValues(data, extract, datasetId) {
  let count = 0;
  async function walk(node, path) {
    if (!node || typeof node !== 'object') return;
    for (const [key, value] of Object.entries(node)) {
      if (SIDECARS.has(key) || METADATA.has(key)) continue;
      const fieldPath = `${path}.${key}`;
      if (typeof value === 'number') {
        const evidence = node.evidence?.artifactId || node.evidence?.derivation ? node.evidence : node.evidence?.[key];
        if (!evidence) throw new Error(`${fieldPath}: numeric field lacks exact evidence`);
        let expected;
        try { expected = await extract(evidence); }
        catch (error) { throw new Error(`${fieldPath}: ${error.message}`, { cause: error }); }
        assertPublishedValue(value, expected, fieldPath);
        count++;
      } else if (value && typeof value === 'object') {
        await walk(value, fieldPath);
      }
    }
  }
  await walk(data, datasetId);
  return count;
}
