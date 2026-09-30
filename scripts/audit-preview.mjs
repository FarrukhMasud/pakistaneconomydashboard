import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluateUpdatePreview } from './lib/preview-validation.mjs';

const dataDir = resolve(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'data');
try {
  const preview = JSON.parse(await readFile(resolve(dataDir, 'update-preview.json'), 'utf8'));
  let approvals = [];
  try {
    const reviews = JSON.parse(await readFile(resolve(dataDir, 'publication-reviews.json'), 'utf8'));
    if (!Array.isArray(reviews.approvals)) throw new Error('Invalid publication review ledger');
    approvals = reviews.approvals;
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  const result = evaluateUpdatePreview(preview, approvals);
  if (!result.approved) throw new Error(`Update requires two-person review (${result.previewHash}):\n${result.problems.join('\n')}`);
  console.log(`Update anomaly review passed${result.problems.length ? ' with recorded approval' : ''}`);
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
}
