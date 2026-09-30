import { execFileSync } from 'node:child_process';
import { readFile, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DATASETS } from './data-catalog.mjs';
import { collectRevisions, describeRevisions } from './lib/data-writer.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const committed = file => JSON.parse(execFileSync('git', ['show', `HEAD:public/data/${file}`], { cwd: root, encoding: 'utf8' }));
const ledger = committed('revisions.json');
if (!Array.isArray(ledger.entries)) throw new Error('Committed revision ledger is invalid');
const today = new Date().toISOString().slice(0, 10);
const entries = [...ledger.entries];
for (const dataset of DATASETS) {
  const before = committed(dataset.file);
  const after = JSON.parse(await readFile(resolve(root, 'public', 'data', dataset.file), 'utf8'));
  entries.push(...describeRevisions(dataset.id, collectRevisions(before, after), today, before, after));
}
entries.sort((a, b) => b.date.localeCompare(a.date));
await writeFile(resolve(root, 'public', 'data', 'revisions.json'), `${JSON.stringify({
  ...ledger, generatedAt: new Date().toISOString(), entryCount: entries.length, entries,
}, null, 2)}\n`);
console.log(`Preserved ${ledger.entries.length} committed revisions and rebuilt ${entries.length - ledger.entries.length} unpublished changes against HEAD`);
