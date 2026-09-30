import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATASETS } from './data-catalog.mjs';
import { auditSourceArtifacts } from './lib/source-evidence.mjs';
import { createNativeVerifier, auditNativeValues } from './lib/native-evidence.mjs';

const dataDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data');

export async function auditEvidence() {
  const catalog = await auditSourceArtifacts();
  const artifacts = new Map(catalog.artifacts.map(receipt => [receipt.artifactId, receipt]));
  const extract = createNativeVerifier(artifacts, resolve(dataDir, '..'));
  for (const dataset of DATASETS) {
    const data = JSON.parse(await readFile(resolve(dataDir, dataset.file), 'utf8'));
    if (data.publication?.status === 'withheld') continue;
    const references = new Set();
    const walk = (value, path) => {
      if (!value || typeof value !== 'object') return;
      if (value.artifactId) {
        const receipt = artifacts.get(value.artifactId);
        if (!receipt) throw new Error(`${dataset.id}.${path}: refers to absent source evidence`);
        if (value.sha256 && value.sha256 !== receipt.sha256) throw new Error(`${dataset.id}.${path}: source evidence hash differs from archive`);
        if (value.sourceUrl && value.sourceUrl !== receipt.sourceUrl) throw new Error(`${dataset.id}.${path}: source URL differs from archived retrieval`);
        references.add(value.artifactId);
      }
      for (const [key, item] of Object.entries(value)) walk(item, path ? `${path}.${key}` : key);
    };
    walk(data, '');
    if (!references.size) throw new Error(`${dataset.id}: published data has no archived official source evidence`);
    if (!data.publicationEvidence) await auditNativeValues(data, extract, dataset.id);
  }
  return catalog;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  auditEvidence().then(catalog => console.log(`Verified ${catalog.artifacts.length} immutable official source artifacts`)).catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
}
