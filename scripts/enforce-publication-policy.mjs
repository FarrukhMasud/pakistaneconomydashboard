#!/usr/bin/env node
import { readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname, basename } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DATASETS } from './data-catalog.mjs';
import { parsePdfTextItems } from './pdf-text.mjs';
import { captureSourceArtifact, getSourceEvidence } from './lib/source-evidence.mjs';
import {
  CURATED_FILES, hashContent, enforcePublicationPolicy, publicationContentHash, publicationEvidenceHash, validateReview,
  applyPublicationPolicy, assessPublication, verifyAutomatedPublicationClaims,
} from './lib/publication-policy.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const DATA_DIR = resolve(ROOT, 'public', 'data');
const DEBT_URL = 'https://www.sbp.org.pk/assets/document/pakdebt.pdf';

export function extractExternalStock(items) {
  const rows = new Map();
  for (const item of items) {
    const key = `${item.page}|${item.y.toFixed(2)}`;
    const row = rows.get(key) || [];
    row.push(item);
    rows.set(key, row);
  }
  const lines = [...rows.values()].map(row => row.sort((a, b) => a.x - b.x)
    .map(item => item.text).join(' ').replace(/\s+/g, ' ').trim());
  const headers = lines.find(line => /\b\d{2}-[A-Za-z]{3}-\d{2}\b/.test(line));
  const dates = [...(headers || '').matchAll(/(\d{2})-([A-Za-z]{3})-(\d{2})/g)];
  if (!dates.length || !lines.some(line => /^\(Million US\$\)$/.test(line))) {
    throw new Error('Official debt table date columns or units were not recognised.');
  }
  const revisionLine = lines.find(line => /^[RP](?:\s+[RP])*$/.test(line));
  const revisionMarkers = revisionLine?.split(/\s+/) || [];
  if (revisionMarkers.length !== dates.length) throw new Error('Official debt table revision markers were not recognised.');
  const totalLine = lines.find(line => /^Total external debt and liabilities \(A\+B\+C\+D\+E\)/i.test(line));
  const imfLine = lines.find(line => /^2\. From IMF\b/.test(line));
  const values = line => (line?.match(/\b\d{1,3}(?:,\d{3})+\b/g) || []).map(value => Number(value.replaceAll(',', '')));
  const totals = values(totalLine);
  const imf = values(imfLine);
  if (totals.length !== dates.length || imf.length !== dates.length) {
    throw new Error('Official debt stock rows do not match the dated columns.');
  }
  const [date] = dates.slice(-1);
  const months = { Jan: '01', Feb: '02', Mar: '03', Apr: '04', May: '05', Jun: '06', Jul: '07', Aug: '08', Sep: '09', Oct: '10', Nov: '11', Dec: '12' };
  if (!months[date[2]]) throw new Error('Unrecognised official debt table month.');
  return {
    totalExternalDebtAndLiabilities: totals.at(-1) / 1000,
    imfOutstanding: imf.at(-1) / 1000,
    asOf: `20${date[3]}-${months[date[2]]}-${date[1]}`,
    unit: 'US$ billion',
    sourceType: 'official-primary',
    status: revisionMarkers.at(-1) === 'P' ? 'provisional' : 'revised',
  };
}

export async function refreshOfficialExternalStock() {
  const response = await fetch(DEBT_URL, { signal: AbortSignal.timeout(30000) });
  if (!response.ok) throw new Error(`Official external-debt PDF HTTP ${response.status}`);
  const body = Buffer.from(await response.arrayBuffer());
  if (body.subarray(0, 5).toString('ascii') !== '%PDF-') throw new Error('Official external-debt source is not a PDF.');
  const receipt = await captureSourceArtifact({
    sourceKey: 'pakdebt.pdf', sourceUrl: DEBT_URL, responseUrl: response.url,
    body, contentType: response.headers.get('content-type'), filename: 'pakdebt.pdf',
    parser: 'enforce-publication-policy.mjs',
  });
  const items = await parsePdfTextItems(resolve(ROOT, 'public', 'source-evidence', basename(receipt.path)));
  const stock = extractExternalStock(items);
  const data = JSON.parse(await readFile(resolve(DATA_DIR, 'external-debt.json'), 'utf8'));
  if (hashContent(data.stock) !== hashContent(stock)) data.lastUpdated = receipt.retrievedAt.slice(0, 10);
  data.stock = stock;
  data.unit = 'US$ billion';
  data.title = 'External Debt and Liabilities';
  data.sourceUrl = DEBT_URL;
  delete data.lastVerified;
  delete data.verificationDate;
  data.observationDate = stock.asOf;
  delete data.publicationDate;
  delete data.verifiedFrom;
  delete data.riskNote;
  data.methodologyNote = 'Outstanding stock is parsed directly from the latest dated column in the archived SBP table, converting million US dollars to billion US dollars. The provisional source status is retained. Repayment, rollover and bond estimates are unavailable without directly supported official evidence and independent reviewer approvals.';
  data.publicationEvidence = {
    stock: {
      sourceType: 'official-primary', method: 'automated', sourceKey: 'pakdebt.pdf',
      sourceUrl: DEBT_URL, artifactId: receipt.artifactId, evidenceHash: receipt.sha256,
      contentHash: hashContent(stock), location: `Outstanding table: total external debt and liabilities and From IMF rows; ${stock.asOf} column`,
      status: stock.status,
    },
  };
  data.publicationEvidence.observationDate = {
    ...data.publicationEvidence.stock,
    contentHash: hashContent(stock.asOf),
    location: `Outstanding table date header; latest column ${stock.asOf}`,
  };
  data.publication = {
    policy: 'official-only', status: 'partial',
    reason: 'Official outstanding debt stock is available. Fiscal-year repayments, rollover assumptions and bond schedules are withheld because exact official evidence and required independent approvals are absent.',
    withheldFields: ['fy26', 'repaymentSplit', 'eurobonds', 'fy27'],
  };
  const dataset = { id: 'external-debt', parser: 'manual-curation' };
  const evidence = { [receipt.sourceKey]: receipt };
  const verifiedAutomatedClaims = await verifyAutomatedPublicationClaims(dataset, data, { evidence, dataDir: DATA_DIR });
  const options = { evidence, verifiedAutomatedClaims };
  const output = applyPublicationPolicy(dataset, data, options);
  const audit = assessPublication(dataset, output, options);
  if (!audit.ok) throw new Error(`Official debt refresh failed publication policy: ${JSON.stringify(audit.violations)}`);
  await writeFile(resolve(DATA_DIR, 'external-debt.json'), `${JSON.stringify(output, null, 2)}\n`);
  return receipt;
}

export async function main() {
  if (process.argv.includes('--review-hashes')) {
    const filename = process.argv[process.argv.indexOf('--review-hashes') + 1];
    if (!filename || !CURATED_FILES.includes(filename)) throw new Error('--review-hashes requires a canonical curated filename.');
    const data = JSON.parse(await readFile(resolve(DATA_DIR, filename), 'utf8'));
    const contentHash = publicationContentHash(data);
    const evidenceHash = publicationEvidenceHash(data.publicationEvidence || {});
    console.log(JSON.stringify({ contentHash, evidenceHash, review: validateReview(data.publication?.review, { contentHash, evidenceHash }) }, null, 2));
    return;
  }
  if (process.argv.includes('--refresh-official-stock')) await refreshOfficialExternalStock();
  const datasets = DATASETS.filter(dataset => CURATED_FILES.includes(dataset.file));
  datasets.push({ id: 'indicators', file: 'indicators.json', parser: 'manual-curation' });
  const reports = await enforcePublicationPolicy({ datasets });
  for (const report of reports) {
    console.log(`${report.id}: ${report.publication.status}; ${report.violations.length} publication violation(s) sanitized`);
    for (const violation of report.violations) console.warn(`  ${violation.path || '(payload)'}: ${violation.reasons.join(' ')}`);
  }
  return reports;
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  main().catch(error => { console.error(`Publication enforcement failed: ${error.message}`); process.exitCode = 1; });
}
