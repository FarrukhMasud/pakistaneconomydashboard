#!/usr/bin/env node
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { DATASETS } from './data-catalog.mjs';
import { CURATED_FILES, assessPublication, verifyAutomatedPublicationClaims, loadPublicationEvidence } from './lib/publication-policy.mjs';

export async function auditPublication({
  dataDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data'),
  datasets = [...DATASETS.filter(dataset => CURATED_FILES.includes(dataset.file)),
    { id: 'indicators', file: 'indicators.json', parser: 'manual-curation' }],
  evidence, derivedInputs, verifiedAutomatedClaims = {},
} = {}) {
  const reports = [];
  for (const dataset of datasets) {
    const data = JSON.parse(await readFile(resolve(dataDir, dataset.file), 'utf8'));
    const receipts = await loadPublicationEvidence(data, { evidence, dataDir });
    const supplied = verifiedAutomatedClaims[dataset.id] || verifiedAutomatedClaims;
    const verified = { ...supplied, ...await verifyAutomatedPublicationClaims(dataset, data, { evidence: receipts, dataDir }) };
    const report = assessPublication(dataset, data, { evidence: receipts, derivedInputs, verifiedAutomatedClaims: verified });
    if (!data.publication) report.violations.push({ path: 'publication', reasons: ['Publication metadata is required.'] });
    report.ok = report.violations.length === 0;
    reports.push({ id: dataset.id, ...report });
  }
  return { ok: reports.every(report => report.ok), reports };
}

if (process.argv[1] && import.meta.url === pathToFileURL(resolve(process.argv[1])).href) {
  auditPublication().then(result => {
    for (const report of result.reports) {
      console.log(`${report.id}: ${report.ok ? 'OK' : 'FAIL'} (${report.publication.status})`);
      for (const violation of report.violations) console.error(`  ${violation.path}: ${violation.reasons.join(' ')}`);
    }
    if (!result.ok) process.exitCode = 1;
  }).catch(error => { console.error(`Publication audit failed: ${error.message}`); process.exitCode = 1; });
}
